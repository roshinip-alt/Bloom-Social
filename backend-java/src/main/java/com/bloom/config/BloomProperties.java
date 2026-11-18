package com.bloom.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed view of the {@code bloom.*} configuration tree. */
@ConfigurationProperties(prefix = "bloom")
public record BloomProperties(
        String publicUrl,
        Workspace workspace,
        Integration integration,
        Crypto crypto,
        OAuth oauth,
        Sync sync) {

    public record Workspace(boolean seedDemoOnEmpty, boolean demoResetEnabled) {}

    public record Integration(String baseUrl, String internalToken, Duration connectTimeout, Duration readTimeout) {
        public boolean hasInternalToken() {
            return internalToken != null && !internalToken.isBlank();
        }
    }

    public record Crypto(String tokenEncryptionKey, int keyVersion) {}

    public record OAuth(Duration sessionTtl) {}

    public record Sync(boolean async, boolean scheduledEnabled, Duration interval, Duration retryPoll, int maxAttempts,
                       Duration baseBackoff, Duration maxBackoff) {}
}
