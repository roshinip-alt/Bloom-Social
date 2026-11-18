package com.bloom.social.gateway;

import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.*;

/** Port to the Node integration service. Abstracted so tests can substitute a fake. */
public interface IntegrationGateway {
    ProvidersResponse providers();

    AuthorizeUrlResponse authorizeUrl(Provider provider, AuthorizeUrlRequest request);

    SyncResult sync(Provider provider, SyncRequest request);

    TokenSet refresh(Provider provider, RefreshRequest request);

    RevokeResponse revoke(Provider provider, RevokeRequest request);
}
