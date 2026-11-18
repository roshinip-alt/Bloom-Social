package com.bloom.social.domain;

public enum Provider {
    INSTAGRAM, YOUTUBE, TIKTOK;

    public String slug() {
        return name().toLowerCase();
    }

    public static Provider fromSlug(String slug) {
        for (Provider p : values()) {
            if (p.slug().equalsIgnoreCase(slug)) return p;
        }
        throw com.bloom.exception.BloomException.notFound("Provider '" + slug + "'");
    }
}
