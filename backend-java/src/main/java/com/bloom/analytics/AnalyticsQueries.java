package com.bloom.analytics;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Read-side aggregation SQL over snapshot tables (kept in one place; JPA is used for writes elsewhere). */
@Repository
public class AnalyticsQueries {
    public record DailyValue(UUID accountId, String metricKey, LocalDate date, BigDecimal value, String availability,
                             Instant fetchedAt, boolean demo) {}

    public record Coverage(UUID accountId, String metricKey, LocalDate first, LocalDate last, Instant lastFetched) {}

    private final NamedParameterJdbcTemplate jdbc;

    public AnalyticsQueries(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Undimensioned DAY snapshots for accounts in [from, to]. */
    public List<DailyValue> daily(Collection<UUID> accountIds, Collection<String> metricKeys, LocalDate from, LocalDate to) {
        if (accountIds.isEmpty()) return List.of();
        var p = new MapSqlParameterSource("ids", accountIds).addValue("from", Date.valueOf(from)).addValue("to", Date.valueOf(to));
        String metricFilter = "";
        if (metricKeys != null) {
            if (metricKeys.isEmpty()) return List.of();
            metricFilter = " AND metric_key IN (:keys)";
            p.addValue("keys", metricKeys);
        }
        return jdbc.query("""
                SELECT account_id, metric_key, snapshot_date, value, availability, fetched_at, is_demo
                FROM analytics_snapshot
                WHERE account_id IN (:ids) AND time_window = 'DAY' AND dimension_key = ''
                  AND snapshot_date BETWEEN :from AND :to""" + metricFilter + " ORDER BY snapshot_date", p,
                (rs, i) -> new DailyValue(rs.getObject(1, UUID.class), rs.getString(2), rs.getDate(3).toLocalDate(),
                        rs.getBigDecimal(4), rs.getString(5), rs.getTimestamp(6).toInstant(), rs.getBoolean(7)));
    }

    /** Most recent undimensioned DAY value on/before a date, per account+metric. */
    public List<DailyValue> latestOnOrBefore(Collection<UUID> accountIds, LocalDate date) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query("""
                SELECT DISTINCT ON (account_id, metric_key) account_id, metric_key, snapshot_date, value, availability,
                       fetched_at, is_demo
                FROM analytics_snapshot
                WHERE account_id IN (:ids) AND time_window = 'DAY' AND dimension_key = '' AND snapshot_date <= :d
                ORDER BY account_id, metric_key, snapshot_date DESC""",
                new MapSqlParameterSource("ids", accountIds).addValue("d", Date.valueOf(date)),
                (rs, i) -> new DailyValue(rs.getObject(1, UUID.class), rs.getString(2), rs.getDate(3).toLocalDate(),
                        rs.getBigDecimal(4), rs.getString(5), rs.getTimestamp(6).toInstant(), rs.getBoolean(7)));
    }

    public List<Coverage> coverage(Collection<UUID> accountIds) {
        if (accountIds.isEmpty()) return List.of();
        return jdbc.query("""
                SELECT account_id, metric_key, min(snapshot_date), max(snapshot_date), max(fetched_at)
                FROM analytics_snapshot WHERE account_id IN (:ids) AND time_window = 'DAY' AND dimension_key = ''
                GROUP BY account_id, metric_key""", new MapSqlParameterSource("ids", accountIds),
                (rs, i) -> new Coverage(rs.getObject(1, UUID.class), rs.getString(2), rs.getDate(3).toLocalDate(),
                        rs.getDate(4).toLocalDate(), rs.getTimestamp(5).toInstant()));
    }

    public record DimensionRow(String metricKey, LocalDate date, String window, String dimensionKey, String dimensions,
                               BigDecimal value, String availability, Instant fetchedAt, String sourceEndpoint,
                               boolean demo) {}

    /** Latest snapshot date's dimensioned rows for each AUDIENCE metric of an account. */
    public List<DimensionRow> latestDimensioned(UUID accountId) {
        return jdbc.query("""
                SELECT s.metric_key, s.snapshot_date, s.time_window, s.dimension_key, s.dimensions::text, s.value,
                       s.availability, s.fetched_at, s.source_endpoint, s.is_demo
                FROM analytics_snapshot s
                JOIN (SELECT metric_key, max(snapshot_date) AS d FROM analytics_snapshot
                      WHERE account_id = :id AND dimension_key <> '' GROUP BY metric_key) l
                  ON l.metric_key = s.metric_key AND l.d = s.snapshot_date
                WHERE s.account_id = :id AND s.dimension_key <> ''
                ORDER BY s.metric_key, s.value DESC NULLS LAST""", new MapSqlParameterSource("id", accountId),
                (rs, i) -> new DimensionRow(rs.getString(1), rs.getDate(2).toLocalDate(), rs.getString(3), rs.getString(4),
                        rs.getString(5), rs.getBigDecimal(6), rs.getString(7), rs.getTimestamp(8).toInstant(),
                        rs.getString(9), rs.getBoolean(10)));
    }

    public record PostRow(UUID id, UUID accountId, String provider, String handle, String providerContentId,
                          String contentType, String title, String permalink, String thumbnailUrl, Instant publishedAt,
                          Integer durationSeconds, boolean demo, Instant fetchedAt) {}

    public long countPosts(Collection<UUID> accountIds, Instant from, Instant to, String contentType) {
        if (accountIds.isEmpty()) return 0;
        var p = postParams(accountIds, from, to, contentType);
        Long n = jdbc.queryForObject("SELECT count(*) FROM social_post p WHERE " + postWhere(contentType), p, Long.class);
        return n == null ? 0 : n;
    }

    /**
     * Posts in range. When {@code sortMetric} is given, ordering uses that metric's latest snapshot (posts without it
     * sort last) — only meaningful within one platform, so callers pass one provider's metric key.
     */
    public List<PostRow> posts(Collection<UUID> accountIds, Instant from, Instant to, String contentType, String sortMetric,
                               boolean desc, int limit, int offset) {
        if (accountIds.isEmpty()) return List.of();
        var p = postParams(accountIds, from, to, contentType).addValue("limit", limit).addValue("offset", offset);
        String order;
        String join = "";
        if (sortMetric != null) {
            join = """
                    LEFT JOIN LATERAL (SELECT value FROM post_metric_snapshot m WHERE m.post_id = p.id AND m.metric_key = :sm
                                       ORDER BY snapshot_date DESC LIMIT 1) sm ON true""";
            p.addValue("sm", sortMetric);
            order = "sm.value " + (desc ? "DESC" : "ASC") + " NULLS LAST, p.published_at DESC";
        } else {
            order = "p.published_at " + (desc ? "DESC" : "ASC");
        }
        return jdbc.query("""
                SELECT p.id, p.account_id, p.provider, a.handle, p.provider_content_id, p.content_type, p.title,
                       p.permalink, p.thumbnail_url, p.published_at, p.duration_seconds, p.is_demo, p.fetched_at
                FROM social_post p JOIN connected_social_account a ON a.id = p.account_id
                """ + join + " WHERE " + postWhere(contentType) + " ORDER BY " + order + " LIMIT :limit OFFSET :offset", p,
                (rs, i) -> new PostRow(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9),
                        rs.getTimestamp(10).toInstant(), (Integer) rs.getObject(11), rs.getBoolean(12),
                        rs.getTimestamp(13).toInstant()));
    }

    public record PostMetricRow(UUID postId, String metricKey, BigDecimal value, LocalDate date) {}

    public List<PostMetricRow> latestPostMetrics(Collection<UUID> postIds) {
        if (postIds.isEmpty()) return List.of();
        return jdbc.query("""
                SELECT DISTINCT ON (post_id, metric_key) post_id, metric_key, value, snapshot_date
                FROM post_metric_snapshot WHERE post_id IN (:ids) AND availability = 'AVAILABLE'
                ORDER BY post_id, metric_key, snapshot_date DESC""", new MapSqlParameterSource("ids", postIds),
                (rs, i) -> new PostMetricRow(rs.getObject(1, UUID.class), rs.getString(2), rs.getBigDecimal(3),
                        rs.getDate(4).toLocalDate()));
    }

    private static MapSqlParameterSource postParams(Collection<UUID> ids, Instant from, Instant to, String type) {
        var p = new MapSqlParameterSource("ids", ids).addValue("from", Timestamp.from(from)).addValue("to", Timestamp.from(to));
        if (type != null) p.addValue("type", type);
        return p;
    }

    private static String postWhere(String type) {
        return "p.account_id IN (:ids) AND p.published_at >= :from AND p.published_at < :to"
                + (type != null ? " AND p.content_type = :type" : "");
    }
}
