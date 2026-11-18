package com.bloom.social.sync;

import com.bloom.social.account.CredentialStore;
import com.bloom.social.account.TokenService;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.DataMode;
import com.bloom.social.gateway.GatewayDtos.SyncRequest;
import com.bloom.social.gateway.GatewayDtos.SyncResult;
import com.bloom.social.gateway.IntegrationGateway;
import org.springframework.stereotype.Component;

/** LIVE accounts: obtain a usable token (refreshing if needed) and ask Node to fetch from the official API. */
@Component
public class GatewaySyncSource implements SyncSource {
    private final TokenService tokens;
    private final IntegrationGateway gateway;

    public GatewaySyncSource(TokenService tokens, IntegrationGateway gateway) {
        this.tokens = tokens;
        this.gateway = gateway;
    }

    @Override
    public boolean supports(ConnectedSocialAccount account) {
        return account.getDataMode() == DataMode.LIVE;
    }

    @Override
    public SyncResult fetch(SyncContext ctx) {
        CredentialStore.Plain cred = tokens.usableCredential(ctx.account());
        return gateway.sync(ctx.account().getProvider(), new SyncRequest(ctx.account().getId().toString(),
                ctx.account().getProviderAccountId(), cred.accessToken(), cred.scopes(), ctx.cursor(), ctx.since(), ctx.until()));
    }
}
