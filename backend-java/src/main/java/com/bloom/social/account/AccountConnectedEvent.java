package com.bloom.social.account;

import java.util.UUID;

/** Published inside the connecting transaction; listeners act after commit (e.g. initial sync). */
public record AccountConnectedEvent(UUID accountId) {}
