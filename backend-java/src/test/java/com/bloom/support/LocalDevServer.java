package com.bloom.support;

import com.bloom.BloomApplication;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.springframework.boot.SpringApplication;

/**
 * Runs the backend locally without Docker: an embedded PostgreSQL (data in a temp directory, discarded on exit) plus
 * the normal application. For development and smoke tests only — see docs/local-development.md.
 */
public final class LocalDevServer {
    private LocalDevServer() {}

    public static void main(String[] args) throws Exception {
        EmbeddedPostgres.Builder builder = EmbeddedPostgres.builder();
        Integer port = Integer.getInteger("bloom.dev.pgPort"); // optional; a free port is chosen otherwise
        if (port != null) builder.setPort(port);
        EmbeddedPostgres pg = builder.start();
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                pg.close();
            } catch (Exception ignored) {
                // best effort
            }
        }));
        setDefault("spring.datasource.url", pg.getJdbcUrl("postgres", "postgres"));
        setDefault("spring.datasource.username", "postgres");
        setDefault("spring.datasource.password", "postgres");
        setDefault("bloom.integration.internal-token", "local-dev-internal-token");
        setDefault("bloom.crypto.token-encryption-key", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=");
        SpringApplication.run(BloomApplication.class, args);
    }

    private static void setDefault(String key, String value) {
        if (System.getProperty(key) == null) System.setProperty(key, value);
    }
}
