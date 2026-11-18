package com.bloom.social.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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

/**
 * One OAuth attempt. Only the SHA-256 of the state is stored; the PKCE verifier and any pending token set
 * (multi-identity selection) are encrypted.
 */
@Entity
@Table(name = "oauth_connect_session")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OAuthConnectSession {
    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Enumerated(EnumType.STRING)
    private Provider provider;
    @Column(name = "state_hash")
    private String stateHash;
    @Column(name = "code_verifier_ciphertext")
    private String codeVerifierCiphertext;
    @Column(name = "redirect_uri")
    private String redirectUri;
    @Enumerated(EnumType.STRING)
    private ConnectSessionStatus status;
    @Column(name = "token_set_ciphertext")
    private String tokenSetCiphertext;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "candidates", columnDefinition = "jsonb")
    private List<IdentityCandidate> candidates = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "connected_account_ids", columnDefinition = "uuid[]")
    private List<UUID> connectedAccountIds = new ArrayList<>();
    @Column(name = "error_code")
    private String errorCode;
    @Column(name = "error_message")
    private String errorMessage;
    @Column(name = "expires_at")
    private Instant expiresAt;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "completed_at")
    private Instant completedAt;

    public OAuthConnectSession(UUID id, UUID workspaceId, Provider provider, String stateHash, String redirectUri,
                               Instant now, Instant expiresAt) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.provider = provider;
        this.stateHash = stateHash;
        this.redirectUri = redirectUri;
        this.status = ConnectSessionStatus.PENDING;
        this.createdAt = now;
        this.expiresAt = expiresAt;
    }

    public boolean isExpired(Instant now) {
        return now.isAfter(expiresAt);
    }

    public void fail(String code, String message, Instant now) {
        this.status = ConnectSessionStatus.FAILED;
        this.errorCode = code;
        this.errorMessage = message;
        this.completedAt = now;
        this.tokenSetCiphertext = null;
        this.codeVerifierCiphertext = null;
    }

    /** Public, non-secret description of an identity returned by the provider. */
    public record IdentityCandidate(String providerAccountId, String handle, String displayName, String avatarUrl,
                                    String accountType, boolean eligible, String ineligibleReason,
                                    java.util.Map<String, String> metadata) {}
}
