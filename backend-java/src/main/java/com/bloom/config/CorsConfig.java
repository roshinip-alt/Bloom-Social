package com.bloom.config;

import com.bloom.auth.LocalWorkspaceContext;
import com.bloom.common.web.CorrelationIdFilter;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Browser traffic normally arrives same-origin via the proxy; CORS only allows the configured public URL. */
@Configuration
public class CorsConfig implements WebMvcConfigurer {
    private final BloomProperties props;

    public CorsConfig(BloomProperties props) {
        this.props = props;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(props.publicUrl())
                .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE")
                .allowedHeaders("Content-Type", LocalWorkspaceContext.HEADER, CorrelationIdFilter.HEADER)
                .exposedHeaders(CorrelationIdFilter.HEADER);
    }
}
