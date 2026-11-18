package com.bloom.social.account;

import com.bloom.social.account.AccountDtos.*;
import com.bloom.social.domain.Provider;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class AccountController {
    private final AccountService service;

    public AccountController(AccountService service) {
        this.service = service;
    }

    @GetMapping("/providers")
    public List<ProviderView> providers() {
        return service.providers();
    }

    @GetMapping("/accounts")
    public List<AccountView> list() {
        return service.list();
    }

    @GetMapping("/accounts/{id}")
    public AccountView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/accounts/{id}/sync")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public SyncJobView sync(@PathVariable UUID id) {
        return service.requestSync(id);
    }

    @GetMapping("/accounts/{id}/sync-jobs")
    public List<SyncJobView> jobs(@PathVariable UUID id, @RequestParam(defaultValue = "20") int limit) {
        return service.jobs(id, limit);
    }

    @PostMapping("/accounts/{id}/disconnect")
    public DisconnectResult disconnect(@PathVariable UUID id, @RequestBody(required = false) DisconnectRequest body) {
        return service.disconnect(id, body != null && body.deleteHistory());
    }

    @DeleteMapping("/accounts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    /** Adds a clearly-labelled DEMO account with synthetic data (no provider involved). */
    @PostMapping("/connections/{provider}/demo")
    @ResponseStatus(HttpStatus.CREATED)
    public AccountView demo(@PathVariable String provider) {
        return service.createDemo(Provider.fromSlug(provider));
    }
}
