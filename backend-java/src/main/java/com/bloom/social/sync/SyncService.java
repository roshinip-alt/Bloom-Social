package com.bloom.social.sync;

import com.bloom.config.BloomProperties;
import com.bloom.exception.BloomException;
import com.bloom.common.persistence.Ids;
import com.bloom.common.web.CorrelationIdFilter;
import com.bloom.social.account.AccountConnectedEvent;
import com.bloom.social.account.TokenService;
import com.bloom.social.domain.*;
import com.bloom.social.gateway.GatewayDtos.ProfileData;
import com.bloom.social.gateway.GatewayDtos.SyncResult;
import com.bloom.social.gateway.GatewayException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.core.task.TaskExecutor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Runs sync jobs. One active job per account. The provider call happens outside any DB transaction.
 * Failure policy: AUTH_INVALID / PERMISSION → account needs reconnect, job FAILED, no retry;
 * RATE_LIMITED / TRANSIENT / UNREACHABLE → bounded exponential backoff with full jitter, honouring Retry-After.
 */
@Service
public class SyncService {
    private static final Logger log = LoggerFactory.getLogger(SyncService.class);
    private static final List<SyncJob.Status> ACTIVE = List.of(SyncJob.Status.QUEUED, SyncJob.Status.RUNNING);
    private static final int FIRST_SYNC_DAYS = 90;
    private static final int OVERLAP_DAYS = 3;

    private final SyncJobRepository jobs;
    private final ConnectedSocialAccountRepository accounts;
    private final List<SyncSource> sources;
    private final SyncPersister persister;
    private final TaskExecutor executor;
    private final TransactionTemplate tx;
    private final ApplicationEventPublisher events;
    private final BloomProperties props;
    private final Clock clock;

    public SyncService(SyncJobRepository jobs, ConnectedSocialAccountRepository accounts, List<SyncSource> sources,
                       SyncPersister persister, @Qualifier("syncExecutor") TaskExecutor executor,
                       PlatformTransactionManager txm, ApplicationEventPublisher events, BloomProperties props, Clock clock) {
        this.jobs = jobs;
        this.accounts = accounts;
        this.sources = sources;
        this.persister = persister;
        this.executor = executor;
        this.tx = new TransactionTemplate(txm);
        // Sync owns its transactions. REQUIRES_NEW matters when called from an AFTER_COMMIT listener, where a
        // REQUIRED template would join the already-committed transaction and silently lose its writes.
        this.tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        this.events = events;
        this.props = props;
        this.clock = clock;
    }

    /** Creates (or returns the already-active) job and runs it in the background. */
    public SyncJob request(UUID accountId, SyncJob.Trigger trigger) {
        SyncJob job = tx.execute(s -> {
            ConnectedSocialAccount a = accounts.findById(accountId).orElseThrow(() -> BloomException.notFound("Account"));
            if (a.getConnectionStatus().needsReconnect() || a.getConnectionStatus() == ConnectionStatus.DISCONNECTED) {
                throw BloomException.conflict("RECONNECT_REQUIRED",
                        "This account must be reconnected before it can sync (" + a.getConnectionStatus() + ").");
            }
            List<SyncJob> latest = jobs.findByAccountIdOrderByCreatedAtDesc(accountId, PageRequest.of(0, 1));
            if (!latest.isEmpty() && latest.get(0).isActive()) return latest.get(0);
            return jobs.save(new SyncJob(Ids.newId(), accountId, trigger, clock.instant()));
        });
        if (job.getStatus() == SyncJob.Status.QUEUED && job.getAttempt() == 0) dispatch(job.getId());
        return job;
    }

    /**
     * Creates a job and runs it on the calling thread. Used for seeding the demo workspace, where the data must exist
     * before the request that triggered it returns.
     */
    public SyncJob syncNow(UUID accountId, SyncJob.Trigger trigger) {
        SyncJob job = tx.execute(s -> jobs.save(new SyncJob(Ids.newId(), accountId, trigger, clock.instant())));
        run(job.getId());
        return jobs.findById(job.getId()).orElseThrow();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onConnected(AccountConnectedEvent e) {
        try {
            request(e.accountId(), SyncJob.Trigger.CONNECT);
        } catch (RuntimeException ex) {
            log.warn("Initial sync for {} not started: {}", e.accountId(), ex.getMessage());
        }
    }

    public void dispatch(UUID jobId) {
        String cid = MDC.get(CorrelationIdFilter.MDC_KEY);
        executor.execute(() -> {
            if (cid != null) MDC.put(CorrelationIdFilter.MDC_KEY, cid);
            try {
                run(jobId);
            } finally {
                MDC.remove(CorrelationIdFilter.MDC_KEY);
            }
        });
    }

    /** Executes one attempt of a job. Public for the scheduler and tests. */
    public void run(UUID jobId) {
        Instant now = clock.instant();
        SyncContext ctx = tx.execute(s -> {
            SyncJob job = jobs.findById(jobId).orElseThrow();
            ConnectedSocialAccount a = accounts.findById(job.getAccountId()).orElseThrow();
            if (!a.isSyncable()) {
                finish(job, SyncJob.Status.FAILED, "ACCOUNT_NOT_SYNCABLE", "Account status is " + a.getConnectionStatus(), now);
                return null;
            }
            job.setStatus(SyncJob.Status.RUNNING);
            job.setAttempt(job.getAttempt() + 1);
            job.setStartedAt(now);
            job.setNextRetryAt(null);
            a.setLastSyncAt(now);
            LocalDate today = LocalDate.ofInstant(now, ZoneOffset.UTC);
            LocalDate until = today.minusDays(1);
            LocalDate since = a.getLastSuccessfulSyncAt() == null || a.isDemo()
                    ? today.minusDays(FIRST_SYNC_DAYS)
                    : LocalDate.ofInstant(a.getLastSuccessfulSyncAt(), ZoneOffset.UTC).minusDays(OVERLAP_DAYS);
            return new SyncContext(a, job.getCursorState(), since, until, today);
        });
        if (ctx == null) return;

        SyncResult result;
        try {
            result = sourceFor(ctx.account()).fetch(ctx);
        } catch (GatewayException e) {
            onFailure(jobId, e);
            return;
        } catch (BloomException e) {
            onFailure(jobId, new GatewayException(GatewayException.Category.NOT_CONFIGURED, e.code(), e.getMessage(), null));
            return;
        } catch (RuntimeException e) {
            log.error("Sync job {} crashed", jobId, e);
            onFailure(jobId, new GatewayException(GatewayException.Category.TRANSIENT, "SYNC_CRASHED", "Unexpected sync error", null));
            return;
        }

        UUID workspaceId = tx.execute(s -> {
            SyncJob job = jobs.findById(jobId).orElseThrow();
            ConnectedSocialAccount a = accounts.findById(job.getAccountId()).orElseThrow();
            Instant done = clock.instant();
            SyncPersister.Outcome out = persister.persist(a, result, done);
            applyProfile(a, result.profile());
            if (result.capabilities() != null && !a.isDemo()) {
                a.setCapabilitySet(toCaps(result.capabilities()));
            }
            List<String> warnings = new ArrayList<>(result.warnings() == null ? List.of() : result.warnings());
            warnings.addAll(out.warnings());
            job.setItemsFetched(out.itemsWritten());
            job.setCursorState(result.nextCursor() == null ? new HashMap<>() : new HashMap<>(result.nextCursor()));
            boolean partial = !result.complete() || !warnings.isEmpty();
            finish(job, partial ? SyncJob.Status.PARTIAL : SyncJob.Status.SUCCEEDED, partial ? "PARTIAL_DATA" : null,
                    partial ? truncate(String.join("; ", warnings)) : null, done);
            a.setLastSuccessfulSyncAt(done);
            a.setConnectionStatus(ConnectionStatus.ACTIVE);
            a.setLastSyncError(partial ? truncate("Partial: " + String.join("; ", warnings)) : null);
            return a.getWorkspaceId();
        });
        events.publishEvent(new SyncCompletedEvent(ctx.account().getId(), workspaceId));
    }

    private void onFailure(UUID jobId, GatewayException e) {
        tx.executeWithoutResult(s -> {
            SyncJob job = jobs.findById(jobId).orElseThrow();
            ConnectedSocialAccount a = accounts.findById(job.getAccountId()).orElseThrow();
            Instant now = clock.instant();
            finish(job, SyncJob.Status.FAILED, e.code(), truncate(e.getMessage()), now);
            boolean retry = e.category().retryable() && job.getAttempt() < props.sync().maxAttempts();
            if (retry) {
                job.setNextRetryAt(now.plus(backoff(job.getAttempt(), e.retryAfterSeconds())));
            }
            ConnectionStatus status = TokenService.statusFor(e.category());
            a.setConnectionStatus(status);
            a.setLastSyncError(truncate(e.getMessage()));
            log.warn("Sync job {} failed ({} / {}), retry={}", jobId, e.category(), e.code(), retry);
        });
    }

    /** Full-jitter exponential backoff, capped; Retry-After (if larger) wins. */
    Duration backoff(int attempt, Long retryAfterSeconds) {
        long base = props.sync().baseBackoff().toMillis();
        long cap = props.sync().maxBackoff().toMillis();
        long exp = Math.min(cap, base * (1L << Math.min(attempt - 1, 20)));
        long jittered = ThreadLocalRandom.current().nextLong(base / 2, Math.max(base / 2 + 1, exp + 1));
        long retryAfter = retryAfterSeconds == null ? 0 : Math.min(cap, retryAfterSeconds * 1000);
        return Duration.ofMillis(Math.max(jittered, retryAfter));
    }

    /** Re-runs failed retryable jobs whose backoff has elapsed. */
    public int retryDue() {
        List<UUID> due = tx.execute(s -> {
            List<UUID> ids = new ArrayList<>();
            for (SyncJob j : jobs.findByStatusAndNextRetryAtBefore(SyncJob.Status.FAILED, clock.instant())) {
                ConnectedSocialAccount a = accounts.findById(j.getAccountId()).orElse(null);
                j.setNextRetryAt(null);
                if (a == null || !a.isSyncable()) continue;
                j.setStatus(SyncJob.Status.QUEUED);
                ids.add(j.getId());
            }
            return ids;
        });
        due.forEach(this::dispatch);
        return due.size();
    }

    /** Enqueues scheduled syncs for LIVE accounts whose last sync is older than the interval. */
    public int enqueueScheduled() {
        Instant threshold = clock.instant().minus(props.sync().interval());
        int n = 0;
        for (ConnectedSocialAccount a : accounts.findByDataModeAndConnectionStatusIn(DataMode.LIVE,
                List.of(ConnectionStatus.ACTIVE, ConnectionStatus.ERROR))) {
            if (a.getLastSyncAt() == null || a.getLastSyncAt().isBefore(threshold)) {
                if (!jobs.existsByAccountIdAndStatusIn(a.getId(), ACTIVE)) {
                    request(a.getId(), SyncJob.Trigger.SCHEDULED);
                    n++;
                }
            }
        }
        return n;
    }

    private SyncSource sourceFor(ConnectedSocialAccount a) {
        return sources.stream().filter(s -> s.supports(a)).findFirst()
                .orElseThrow(() -> new IllegalStateException("No sync source for " + a.getDataMode()));
    }

    private static void applyProfile(ConnectedSocialAccount a, ProfileData p) {
        if (p == null) return;
        if (p.handle() != null) a.setHandle(p.handle());
        if (p.displayName() != null) a.setDisplayName(p.displayName());
        if (p.avatarUrl() != null) a.setAvatarUrl(p.avatarUrl());
        if (p.accountType() != null) a.setAccountType(p.accountType());
    }

    private static java.util.Set<Capability> toCaps(List<String> raw) {
        java.util.Set<Capability> set = java.util.EnumSet.noneOf(Capability.class);
        for (String r : raw) {
            try {
                Capability c = Capability.valueOf(r);
                if (c != Capability.PUBLISHING) set.add(c);
            } catch (IllegalArgumentException ignored) {
                // tolerate capabilities introduced by a newer integration service
            }
        }
        return set;
    }

    private static void finish(SyncJob job, SyncJob.Status status, String code, String message, Instant at) {
        job.setStatus(status);
        job.setErrorCode(code);
        job.setErrorMessage(message);
        job.setFinishedAt(at);
    }

    private static String truncate(String s) {
        return s == null || s.length() <= 500 ? s : s.substring(0, 500);
    }
}
