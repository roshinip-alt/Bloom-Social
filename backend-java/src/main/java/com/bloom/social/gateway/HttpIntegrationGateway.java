package com.bloom.social.gateway;

import com.bloom.config.BloomProperties;
import com.bloom.common.web.CorrelationIdFilter;
import com.bloom.auth.InternalTokenFilter;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.function.Supplier;
import org.slf4j.MDC;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

/** RestClient implementation with timeouts, internal token and correlation-id propagation. */
@Component
public class HttpIntegrationGateway implements IntegrationGateway {
    private final RestClient client;
    private final ObjectMapper mapper;

    public HttpIntegrationGateway(BloomProperties props, ObjectMapper mapper, RestClient.Builder builder) {
        this.mapper = mapper;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(props.integration().connectTimeout());
        factory.setReadTimeout(props.integration().readTimeout());
        String token = props.integration().internalToken() == null ? "" : props.integration().internalToken();
        this.client = builder.clone()
                .baseUrl(props.integration().baseUrl())
                .requestFactory(factory)
                .defaultHeader(InternalTokenFilter.HEADER, token)
                .requestInterceptor((req, body, exec) -> {
                    String cid = MDC.get(CorrelationIdFilter.MDC_KEY);
                    if (cid != null) req.getHeaders().set(CorrelationIdFilter.HEADER, cid);
                    return exec.execute(req, body);
                })
                .defaultStatusHandler(status -> status.isError(), (req, res) -> {
                    GatewayError err;
                    try {
                        err = mapper.readValue(res.getBody(), GatewayError.class);
                    } catch (IOException e) {
                        err = new GatewayError("GATEWAY_" + res.getStatusCode().value(), "TRANSIENT",
                                "Integration service returned " + res.getStatusCode().value(), null);
                    }
                    throw toException(err);
                })
                .build();
    }

    @Override
    public ProvidersResponse providers() {
        return call(() -> client.get().uri("/internal/v1/providers").retrieve().body(ProvidersResponse.class));
    }

    @Override
    public AuthorizeUrlResponse authorizeUrl(Provider provider, AuthorizeUrlRequest request) {
        return call(() -> client.post().uri("/internal/v1/providers/{p}/authorize-url", provider.slug())
                .body(request).retrieve().body(AuthorizeUrlResponse.class));
    }

    @Override
    public SyncResult sync(Provider provider, SyncRequest request) {
        return call(() -> client.post().uri("/internal/v1/providers/{p}/sync", provider.slug())
                .body(request).retrieve().body(SyncResult.class));
    }

    @Override
    public TokenSet refresh(Provider provider, RefreshRequest request) {
        return call(() -> client.post().uri("/internal/v1/providers/{p}/refresh", provider.slug())
                .body(request).retrieve().body(TokenSet.class));
    }

    @Override
    public RevokeResponse revoke(Provider provider, RevokeRequest request) {
        return call(() -> client.post().uri("/internal/v1/providers/{p}/revoke", provider.slug())
                .body(request).retrieve().body(RevokeResponse.class));
    }

    private static <T> T call(Supplier<T> s) {
        try {
            return s.get();
        } catch (ResourceAccessException e) {
            throw new GatewayException(GatewayException.Category.UNREACHABLE, "INTEGRATION_UNREACHABLE",
                    "The integration service is not reachable", null);
        }
    }

    static GatewayException toException(GatewayError err) {
        GatewayException.Category cat;
        try {
            cat = GatewayException.Category.valueOf(err.category());
        } catch (RuntimeException e) {
            cat = GatewayException.Category.TRANSIENT;
        }
        return new GatewayException(cat, err.code(), err.message(), err.retryAfterSeconds());
    }
}
