package com.bloom.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class ClockConfig {
    /** Single UTC clock so services and tests agree on "now". */
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
