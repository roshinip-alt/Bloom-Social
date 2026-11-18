package com.bloom.social.domain;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** Encrypted provider credentials. Never serialised to any API response. */
@Entity
@Table(name = "provider_token_credential")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProviderTokenCredential extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "account_id")
    private UUID accountId;
    @Column(name = "access_token_ciphertext")
    private String accessTokenCiphertext;
    @Column(name = "refresh_token_ciphertext")
    private String refreshTokenCiphertext;
    @Column(name = "key_version")
    private int keyVersion;
    @Column(name = "token_type")
    private String tokenType;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "scopes", columnDefinition = "text[]")
    private List<String> scopes = new ArrayList<>();
    @Column(name = "access_expires_at")
    private Instant accessExpiresAt;
    @Column(name = "refresh_expires_at")
    private Instant refreshExpiresAt;

    public ProviderTokenCredential(UUID id, UUID accountId) {
        this.id = id;
        this.accountId = accountId;
    }

    @Override
    public String toString() {
        return "ProviderTokenCredential[account=" + accountId + ", redacted]";
    }
}
