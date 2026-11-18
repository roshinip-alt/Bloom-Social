package com.bloom.social.connect;

import com.bloom.social.domain.ConnectSessionStatus;
import com.bloom.social.domain.OAuthConnectSession.IdentityCandidate;
import com.bloom.social.gateway.GatewayDtos.TokenSet;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ConnectDtos {
    private ConnectDtos() {}

    public record StartResponse(UUID sessionId, String authorizationUrl, Instant expiresAt) {}

    public record SessionView(UUID id, String provider, ConnectSessionStatus status, List<IdentityCandidate> candidates,
                              List<UUID> connectedAccountIds, String errorCode, String errorMessage,
                              Instant createdAt, Instant expiresAt) {}

    public record SelectRequest(@NotEmpty List<@NotBlank String> providerAccountIds) {}

    // ---- internal (Node → Java)
    public record ResolveRequest(@NotBlank String provider, @NotBlank String state) {}

    public record ResolveResponse(UUID sessionId, String codeVerifier, String redirectUri) {
        @Override
        public String toString() {
            return "ResolveResponse[" + sessionId + ", verifier=redacted]";
        }
    }

    public record CompleteRequest(@NotNull @Valid TokenSet tokens, @NotNull List<@Valid Identity> identities,
                                  List<String> capabilities) {}

    public record Identity(@NotBlank String providerAccountId, String handle, String displayName, String avatarUrl,
                           String accountType, boolean eligible, String ineligibleReason,
                           java.util.Map<String, String> metadata) {
        IdentityCandidate toCandidate() {
            return new IdentityCandidate(providerAccountId, handle, displayName, avatarUrl, accountType, eligible,
                    ineligibleReason, metadata == null ? java.util.Map.of() : metadata);
        }
    }

    public record CompleteResponse(UUID sessionId, ConnectSessionStatus status, String returnPath) {}

    public record FailRequest(@NotBlank String provider, @NotBlank String state, @NotBlank String errorCode,
                              String errorMessage) {}
}
