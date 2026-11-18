package com.bloom.social.account;

import com.bloom.social.domain.ConnectionStatus;
import com.bloom.social.domain.DataMode;
import com.bloom.social.domain.SyncJob;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Account-facing DTOs. Deliberately contain no token material. */
public final class AccountDtos {
    private AccountDtos() {}

    public record SyncJobView(UUID id, SyncJob.Trigger trigger, SyncJob.Status status, int attempt, int itemsFetched,
                              String errorCode, String errorMessage, Instant nextRetryAt, Instant startedAt,
                              Instant finishedAt, Instant createdAt) {
        public static SyncJobView of(SyncJob j) {
            return new SyncJobView(j.getId(), j.getTriggerType(), j.getStatus(), j.getAttempt(), j.getItemsFetched(),
                    j.getErrorCode(), j.getErrorMessage(), j.getNextRetryAt(), j.getStartedAt(), j.getFinishedAt(),
                    j.getCreatedAt());
        }
    }

    public record AccountView(UUID id, String provider, String providerAccountId, String handle, String displayName,
                              String avatarUrl, String accountType, DataMode dataMode, ConnectionStatus connectionStatus,
                              boolean needsReconnect, List<String> grantedScopes, List<String> capabilities,
                              Instant lastSyncAt, Instant lastSuccessfulSyncAt, String lastSyncError,
                              Instant connectedAt, Instant disconnectedAt, Instant tokenExpiresAt,
                              SyncJobView latestJob) {}

    public record ProviderView(String provider, String displayName, String apiFamily, String docsPath,
                               List<String> requestedScopes, List<String> supportedCapabilities,
                               List<String> dataAccessed, List<String> notAvailable, List<String> prerequisites,
                               String accessExplanation, boolean docsVerified, boolean liveConfigured,
                               boolean integrationReachable, List<String> missingConfig, String redirectUri,
                               boolean demoAvailable) {}

    public record DisconnectRequest(boolean deleteHistory) {}

    public enum Revocation { REVOKED, NOT_SUPPORTED, FAILED, NOT_APPLICABLE }

    public record DisconnectResult(UUID accountId, Revocation revocation, String note, boolean historyRetained) {}
}
