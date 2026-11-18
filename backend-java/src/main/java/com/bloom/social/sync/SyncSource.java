package com.bloom.social.sync;

import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.gateway.GatewayDtos.SyncResult;

/** Strategy: where an account's data comes from (official API via Node, or the labelled demo generator). */
public interface SyncSource {
    boolean supports(ConnectedSocialAccount account);

    SyncResult fetch(SyncContext context);
}
