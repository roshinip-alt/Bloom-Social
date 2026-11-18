package com.bloom;

import static org.assertj.core.api.Assertions.assertThat;

import com.bloom.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Boots the full context against a clean database: Flyway migrates, Hibernate validates every entity mapping,
 * and the demo/personal workspaces are created on startup.
 */
class SchemaValidationTest extends IntegrationTest {
    @Autowired
    JdbcTemplate jdbc;

    @Test
    void migrationsApplyAndWorkspacesAreSeeded() {
        assertThat(count("SELECT count(*) FROM social_provider")).isEqualTo(3);
        assertThat(count("SELECT count(*) FROM workspace WHERE is_demo")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM workspace WHERE NOT is_demo")).isEqualTo(1);
    }

    @Test
    void demoWorkspaceIsClearlySyntheticAndPopulated() {
        String demoWs = "(SELECT id FROM workspace WHERE is_demo)";
        assertThat(count("SELECT count(*) FROM connected_social_account WHERE workspace_id = " + demoWs + " AND data_mode = 'DEMO'")).isEqualTo(4);
        // The demo workspace never holds live data, and demo accounts never live outside it.
        assertThat(count("SELECT count(*) FROM connected_social_account WHERE workspace_id = " + demoWs + " AND data_mode = 'LIVE'")).isZero();
        assertThat(count("SELECT count(*) FROM connected_social_account WHERE workspace_id <> " + demoWs + " AND data_mode = 'DEMO'")).isZero();
        assertThat(count("""
                SELECT count(*) FROM analytics_snapshot s JOIN connected_social_account a ON a.id = s.account_id
                WHERE s.is_demo <> (a.data_mode = 'DEMO')""")).isZero();
        assertThat(count("SELECT count(*) FROM analytics_snapshot")).isGreaterThan(1000);
        assertThat(count("SELECT count(*) FROM social_post WHERE is_demo")).isGreaterThan(20);
        assertThat(count("SELECT count(*) FROM task")).isGreaterThan(5);
        assertThat(count("SELECT count(*) FROM goal WHERE progress_source = 'ANALYTICS'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM goal_progress_entry WHERE source = 'ANALYTICS'")).isPositive();
        assertThat(count("SELECT count(*) FROM content_version")).isGreaterThan(5);
        assertThat(count("SELECT count(*) FROM payment_record")).isEqualTo(4);
        assertThat(count("SELECT count(*) FROM connected_social_account WHERE connection_status = 'EXPIRED'")).isEqualTo(1);
    }

    private int count(String sql) {
        Integer n = jdbc.queryForObject(sql, Integer.class);
        return n == null ? 0 : n;
    }
}
