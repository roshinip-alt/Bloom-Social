package com.bloom.social.account;

import com.bloom.social.domain.Provider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.web.bind.annotation.*;

/**
 * Node → Java notifications from provider webhooks (e.g. Meta's deauthorize and data-deletion callbacks).
 * Protected by InternalTokenFilter; never exposed through the public proxy.
 */
@RestController
@RequestMapping("/internal/v1/accounts")
public class InternalAccountController {
    private final AccountService service;

    public InternalAccountController(AccountService service) {
        this.service = service;
    }

    public record ProviderIdentity(@NotNull Provider provider, @NotBlank String providerAccountId) {}

    public record WebhookOutcome(boolean matched) {}

    /** The owner removed Bloom at the provider: credentials are dropped and the account must be reconnected. */
    @PostMapping("/deauthorized")
    public WebhookOutcome deauthorized(@Valid @RequestBody ProviderIdentity body) {
        return new WebhookOutcome(service.markDeauthorized(body.provider(), body.providerAccountId()));
    }

    /** The owner asked the provider to delete their data: the account and all its snapshots are deleted. */
    @PostMapping("/data-deletion")
    public WebhookOutcome dataDeletion(@Valid @RequestBody ProviderIdentity body) {
        return new WebhookOutcome(service.deleteForProviderRequest(body.provider(), body.providerAccountId()));
    }
}
