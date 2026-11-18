package com.bloom.social.account;

import com.bloom.common.crypto.TokenCipher;
import com.bloom.common.persistence.Ids;
import com.bloom.social.domain.ProviderTokenCredential;
import com.bloom.social.domain.ProviderTokenCredentialRepository;
import com.bloom.social.gateway.GatewayDtos.TokenSet;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** The only class that encrypts/decrypts stored provider tokens. */
@Component
public class CredentialStore {
    public record Plain(String accessToken, String refreshToken, Instant accessExpiresAt, Instant refreshExpiresAt,
                        List<String> scopes) {
        @Override
        public String toString() {
            return "Plain[redacted]";
        }
    }

    private final ProviderTokenCredentialRepository repository;
    private final TokenCipher cipher;

    public CredentialStore(ProviderTokenCredentialRepository repository, TokenCipher cipher) {
        this.repository = repository;
        this.cipher = cipher;
    }

    public void save(UUID accountId, TokenSet tokens, Instant now) {
        ProviderTokenCredential c = repository.findByAccountId(accountId)
                .orElseGet(() -> new ProviderTokenCredential(Ids.newId(), accountId));
        c.setAccessTokenCiphertext(cipher.encrypt(tokens.accessToken()));
        if (tokens.refreshToken() != null && !tokens.refreshToken().isBlank()) {
            c.setRefreshTokenCiphertext(cipher.encrypt(tokens.refreshToken()));
        }
        c.setKeyVersion(cipher.keyVersion());
        c.setTokenType(tokens.tokenType());
        if (tokens.scopes() != null && !tokens.scopes().isEmpty()) {
            c.setScopes(new ArrayList<>(tokens.scopes()));
        }
        c.setAccessExpiresAt(tokens.expiresInSeconds() == null ? null : now.plusSeconds(tokens.expiresInSeconds()));
        if (tokens.refreshExpiresInSeconds() != null) {
            c.setRefreshExpiresAt(now.plusSeconds(tokens.refreshExpiresInSeconds()));
        }
        repository.save(c);
    }

    public Optional<Plain> load(UUID accountId) {
        return repository.findByAccountId(accountId).map(c -> new Plain(
                cipher.decrypt(c.getAccessTokenCiphertext()),
                c.getRefreshTokenCiphertext() == null ? null : cipher.decrypt(c.getRefreshTokenCiphertext()),
                c.getAccessExpiresAt(), c.getRefreshExpiresAt(), List.copyOf(c.getScopes())));
    }

    public Optional<Instant> accessExpiry(UUID accountId) {
        return repository.findByAccountId(accountId).map(ProviderTokenCredential::getAccessExpiresAt);
    }

    public void delete(UUID accountId) {
        repository.deleteByAccountId(accountId);
    }
}
