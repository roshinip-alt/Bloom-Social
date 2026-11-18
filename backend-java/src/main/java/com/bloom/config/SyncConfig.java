package com.bloom.config;

import com.bloom.config.BloomProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.SyncTaskExecutor;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

@Configuration
public class SyncConfig {
    /** Bounded pool for sync jobs; synchronous when bloom.sync.async=false (tests). */
    @Bean
    public TaskExecutor syncExecutor(BloomProperties props) {
        if (!props.sync().async()) return new SyncTaskExecutor();
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(2);
        ex.setMaxPoolSize(4);
        ex.setQueueCapacity(200);
        ex.setThreadNamePrefix("sync-");
        ex.initialize();
        return ex;
    }
}
