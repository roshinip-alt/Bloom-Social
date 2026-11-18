package com.bloom.social.domain;

/** What an account can do, derived from provider support AND scopes actually granted. Drives the UI. */
public enum Capability {
    PROFILE_READ, ACCOUNT_METRICS, CONTENT_LIST, CONTENT_METRICS, AUDIENCE_INSIGHTS, PUBLISHING, TOKEN_REFRESH
}
