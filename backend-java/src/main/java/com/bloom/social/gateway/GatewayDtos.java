package com.bloom.social.gateway;

import com.bloom.social.domain.Availability;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Java ↔ Node integration-service contract (see docs/architecture.md §Java↔Node contract).
 * Field names are the JSON wire names. Token-bearing records are never logged.
 */
public final class GatewayDtos {
    private GatewayDtos() {}

    public record ProviderStatus(String provider, boolean configured, List<String> scopes, String apiVersion,
                                 List<String> missingConfig) {}

    public record ProvidersResponse(List<ProviderStatus> providers) {}

    public record AuthorizeUrlRequest(String state, String codeChallenge, String redirectUri) {}

    public record AuthorizeUrlResponse(String authorizationUrl) {}

    /** Provider token set. {@code toString} is redacted so it cannot leak through logging. */
    public record TokenSet(String accessToken, String refreshToken, String tokenType, List<String> scopes,
                           Long expiresInSeconds, Long refreshExpiresInSeconds) {
        @Override
        public String toString() {
            return "TokenSet[redacted, scopes=" + scopes + "]";
        }
    }

    public record SyncRequest(String accountId, String providerAccountId, String accessToken, List<String> grantedScopes,
                              Map<String, Object> cursor, LocalDate since, LocalDate until) {
        @Override
        public String toString() {
            return "SyncRequest[account=" + accountId + ", token=redacted]";
        }
    }

    public record ProfileData(String handle, String displayName, String avatarUrl, String accountType) {}

    public record MetricPoint(String metricKey, LocalDate date, String timeWindow, Map<String, String> dimensions,
                              BigDecimal value, Availability availability, String sourceEndpoint, String apiVersion) {}

    public record PostMetric(String metricKey, BigDecimal value, Availability availability, String sourceEndpoint,
                             String apiVersion) {}

    public record PostData(String providerContentId, String contentType, String title, String permalink,
                           String thumbnailUrl, Instant publishedAt, Integer durationSeconds, List<PostMetric> metrics) {}

    public record SyncResult(ProfileData profile, List<String> capabilities, List<MetricPoint> accountMetrics,
                             List<PostData> posts, Map<String, Object> nextCursor, boolean complete,
                             List<String> warnings) {}

    public record RefreshRequest(String accessToken, String refreshToken) {
        @Override
        public String toString() {
            return "RefreshRequest[redacted]";
        }
    }

    public record RevokeRequest(String accessToken, String refreshToken) {
        @Override
        public String toString() {
            return "RevokeRequest[redacted]";
        }
    }

    public record RevokeResponse(boolean supported, boolean revoked, String note) {}

    /** Error body Node returns for any failed internal call. */
    public record GatewayError(String code, String category, String message, Long retryAfterSeconds) {}
}
