package com.bloom.social.gateway;

/** A classified failure from the integration service or a provider behind it. */
public class GatewayException extends RuntimeException {
    public enum Category {
        /** invalid_grant / revoked / expired token: needs reconnection, never retried. */
        AUTH_INVALID,
        /** scope missing or permission denied: needs reconnection with consent, never retried. */
        PERMISSION,
        RATE_LIMITED,
        TRANSIENT,
        BAD_RESPONSE,
        NOT_CONFIGURED,
        UNREACHABLE;

        public boolean retryable() {
            return this == RATE_LIMITED || this == TRANSIENT || this == UNREACHABLE;
        }
    }

    private final Category category;
    private final String code;
    private final Long retryAfterSeconds;

    public GatewayException(Category category, String code, String message, Long retryAfterSeconds) {
        super(message);
        this.category = category;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public Category category() { return category; }
    public String code() { return code; }
    public Long retryAfterSeconds() { return retryAfterSeconds; }
}
