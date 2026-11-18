package com.bloom.auth;

import com.bloom.user.Workspace;
import java.time.ZoneId;
import java.util.UUID;

/**
 * The ownership seam. Every product query is scoped by {@link #id()}.
 *
 * <p>V1 has no Bloom app authentication (deliberately out of scope). {@link LocalWorkspaceContext} resolves the
 * workspace selected by the local UI. Adding app auth later means replacing that implementation with one that
 * resolves — and authorises — the signed-in user's workspace; no feature module changes.</p>
 */
public interface CurrentWorkspace {
    Workspace workspace();

    default UUID id() {
        return workspace().getId();
    }

    default ZoneId zone() {
        return ZoneId.of(workspace().getTimezone());
    }

    default boolean isDemo() {
        return workspace().isDemo();
    }
}
