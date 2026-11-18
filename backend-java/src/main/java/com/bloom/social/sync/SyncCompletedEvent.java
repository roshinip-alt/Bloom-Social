package com.bloom.social.sync;

import java.util.UUID;

/** Published after a sync stores new snapshots (other modules, e.g. goals, may react). */
public record SyncCompletedEvent(UUID accountId, UUID workspaceId) {}
