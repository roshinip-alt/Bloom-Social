package com.bloom.social.sync;

import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.gateway.GatewayDtos.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Idempotent upserts: re-running a sync for the same window overwrites the same rows (unique keys on
 * account+metric+date+window+dimensions, provider+account+content id, post+metric+date). Unknown metric keys are
 * skipped and reported as warnings instead of failing the sync.
 */
@Component
public class SyncPersister {
    public record Outcome(int itemsWritten, List<String> warnings) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public SyncPersister(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public Outcome persist(ConnectedSocialAccount account, SyncResult result, Instant fetchedAt) {
        Set<String> known = new HashSet<>(jdbc.queryForList(
                "SELECT metric_key FROM metric_definition WHERE provider = ?", String.class, account.getProvider().name()));
        Set<String> unknown = new HashSet<>();
        boolean demo = account.isDemo();
        Timestamp ts = Timestamp.from(fetchedAt);
        int written = 0;

        List<MetricPoint> metrics = result.accountMetrics() == null ? List.of() : result.accountMetrics();
        List<Object[]> rows = metrics.stream().filter(p -> {
            if (known.contains(p.metricKey())) return true;
            unknown.add(p.metricKey());
            return false;
        }).map(p -> new Object[]{UUID.randomUUID(), account.getId(), p.metricKey(), p.date(),
                p.timeWindow() == null ? "DAY" : p.timeWindow(), dimensionKey(p.dimensions()), json(p.dimensions()),
                p.value(), p.availability().name(), p.sourceEndpoint(), p.apiVersion(), demo, ts}).toList();
        if (!rows.isEmpty()) {
            jdbc.batchUpdate("""
                    INSERT INTO analytics_snapshot (id, account_id, metric_key, snapshot_date, time_window, dimension_key,
                        dimensions, value, availability, source_endpoint, api_version, is_demo, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (account_id, metric_key, snapshot_date, time_window, dimension_key) DO UPDATE SET
                        dimensions = EXCLUDED.dimensions, value = EXCLUDED.value, availability = EXCLUDED.availability,
                        source_endpoint = EXCLUDED.source_endpoint, api_version = EXCLUDED.api_version,
                        fetched_at = EXCLUDED.fetched_at
                    """, rows);
            written += rows.size();
        }

        List<PostData> posts = result.posts() == null ? List.of() : result.posts();
        java.sql.Date today = java.sql.Date.valueOf(fetchedAt.atZone(java.time.ZoneOffset.UTC).toLocalDate());
        for (PostData post : posts) {
            UUID postId = jdbc.queryForObject("""
                    INSERT INTO social_post (id, account_id, provider, provider_content_id, content_type, title, permalink,
                        thumbnail_url, published_at, duration_seconds, is_demo, fetched_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (provider, account_id, provider_content_id) DO UPDATE SET
                        content_type = EXCLUDED.content_type, title = EXCLUDED.title, permalink = EXCLUDED.permalink,
                        thumbnail_url = EXCLUDED.thumbnail_url, duration_seconds = EXCLUDED.duration_seconds,
                        fetched_at = EXCLUDED.fetched_at, updated_at = now()
                    RETURNING id
                    """, UUID.class, UUID.randomUUID(), account.getId(), account.getProvider().name(),
                    post.providerContentId(), post.contentType(), truncate(post.title(), 512), post.permalink(),
                    post.thumbnailUrl(), Timestamp.from(post.publishedAt()), post.durationSeconds(), demo, ts);
            written++;
            List<Object[]> pm = (post.metrics() == null ? List.<PostMetric>of() : post.metrics()).stream().filter(x -> {
                if (known.contains(x.metricKey())) return true;
                unknown.add(x.metricKey());
                return false;
            }).map(x -> new Object[]{UUID.randomUUID(), postId, x.metricKey(), today, x.value(), x.availability().name(),
                    x.sourceEndpoint(), x.apiVersion(), ts}).toList();
            if (!pm.isEmpty()) {
                jdbc.batchUpdate("""
                        INSERT INTO post_metric_snapshot (id, post_id, metric_key, snapshot_date, value, availability,
                            source_endpoint, api_version, fetched_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT (post_id, metric_key, snapshot_date) DO UPDATE SET
                            value = EXCLUDED.value, availability = EXCLUDED.availability,
                            source_endpoint = EXCLUDED.source_endpoint, api_version = EXCLUDED.api_version,
                            fetched_at = EXCLUDED.fetched_at
                        """, pm);
                written += pm.size();
            }
        }
        List<String> warnings = unknown.stream().sorted().map(k -> "Skipped unknown metric '" + k + "'")
                .collect(Collectors.toList());
        return new Outcome(written, warnings);
    }

    static String dimensionKey(Map<String, String> dims) {
        if (dims == null || dims.isEmpty()) return "";
        return new TreeMap<>(dims).entrySet().stream().map(e -> e.getKey() + "=" + e.getValue())
                .collect(Collectors.joining("|"));
    }

    private String json(Map<String, String> dims) {
        try {
            return mapper.writeValueAsString(dims == null ? Map.of() : dims);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String truncate(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
