package com.bloom.social.domain;

public enum ConnectionStatus {
    ACTIVE, EXPIRED, PERMISSION_DENIED, REVOKED, DISCONNECTED, ERROR;

    /** Statuses where only the owner re-authorising can fix things; sync must not retry. */
    public boolean needsReconnect() {
        return this == EXPIRED || this == PERMISSION_DENIED || this == REVOKED;
    }
}
