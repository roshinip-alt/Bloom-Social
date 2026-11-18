package com.bloom.social.account;

import com.bloom.common.persistence.Ids;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectedSocialAccountRepository;
import com.bloom.social.domain.DataMode;
import com.bloom.social.domain.Provider;
import com.bloom.social.sync.DemoSyncSource;
import java.util.ArrayList;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** Creates clearly-labelled DEMO accounts. Their provider ids start with "demo-" and never collide with live ids. */
@Component
public class DemoAccountFactory {
    private final ConnectedSocialAccountRepository accounts;

    public DemoAccountFactory(ConnectedSocialAccountRepository accounts) {
        this.accounts = accounts;
    }

    public ConnectedSocialAccount create(UUID workspaceId, Provider provider, String handle, String displayName) {
        long existing = accounts.findByWorkspaceIdAndDataMode(workspaceId, DataMode.DEMO).stream()
                .filter(a -> a.getProvider() == provider).count();
        String suffix = existing == 0 ? "" : "-" + (existing + 1);
        ConnectedSocialAccount a = new ConnectedSocialAccount(Ids.newId(), workspaceId, provider,
                "demo-" + provider.slug() + "-" + UUID.randomUUID().toString().substring(0, 8), DataMode.DEMO);
        a.setHandle(handle != null ? handle : "demo." + provider.slug() + suffix);
        a.setDisplayName(displayName != null ? displayName : "Demo " + capitalize(provider.slug()) + suffix.replace("-", " "));
        a.setAccountType(switch (provider) {
            case INSTAGRAM -> "Media_Creator";
            case YOUTUBE -> "Channel";
            case TIKTOK -> "Creator";
        });
        a.setGrantedScopes(new ArrayList<>());
        a.setCapabilities(new ArrayList<>(DemoSyncSource.capabilitiesFor(provider)));
        return accounts.save(a);
    }

    private static String capitalize(String s) {
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
