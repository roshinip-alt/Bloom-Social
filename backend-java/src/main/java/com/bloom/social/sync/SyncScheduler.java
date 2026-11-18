package com.bloom.social.sync;

import com.bloom.config.BloomProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Periodic sync of LIVE accounts and retry of backed-off jobs. Disabled with BLOOM_SCHEDULED_SYNC=false. */
@Component
public class SyncScheduler {
    private static final Logger log = LoggerFactory.getLogger(SyncScheduler.class);
    private final SyncService sync;
    private final BloomProperties props;

    public SyncScheduler(SyncService sync, BloomProperties props) {
        this.sync = sync;
        this.props = props;
    }

    @Scheduled(initialDelayString = "PT1M", fixedDelayString = "${bloom.sync.retry-poll}")
    public void tick() {
        if (!props.sync().scheduledEnabled()) return;
        try {
            int retried = sync.retryDue();
            int queued = sync.enqueueScheduled();
            if (retried + queued > 0) log.info("Sync scheduler: {} retried, {} queued", retried, queued);
        } catch (RuntimeException e) {
            log.warn("Sync scheduler tick failed: {}", e.getMessage());
        }
    }
}
