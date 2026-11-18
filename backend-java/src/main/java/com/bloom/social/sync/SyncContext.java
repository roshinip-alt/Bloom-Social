package com.bloom.social.sync;

import com.bloom.social.domain.ConnectedSocialAccount;
import java.time.LocalDate;
import java.util.Map;

/** Input to a sync source: which account, resumable cursor, and the inclusive date window to fetch. */
public record SyncContext(ConnectedSocialAccount account, Map<String, Object> cursor, LocalDate since, LocalDate until,
                          LocalDate today) {}
