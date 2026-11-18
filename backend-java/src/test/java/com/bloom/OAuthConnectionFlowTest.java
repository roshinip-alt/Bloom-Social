package com.bloom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.http.HttpMethod.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.bloom.auth.InternalTokenFilter;
import com.bloom.common.crypto.Hashing;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.*;
import com.bloom.social.gateway.GatewayException;
import com.bloom.social.gateway.IntegrationGateway;
import com.bloom.support.ApiTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * The Java side of the provider OAuth flow with the integration service mocked: no live credentials needed.
 * Covers state binding and single use, PKCE, multiple identities, ineligible identities, provider errors,
 * encrypted token storage, invalid_grant handling and revocation on disconnect.
 */
class OAuthConnectionFlowTest extends ApiTest {
    private static final String ACCESS_TOKEN = "live-access-token-SECRET";

    @MockitoBean
    IntegrationGateway gateway;
    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void stubGateway() {
        when(gateway.authorizeUrl(any(), any())).thenAnswer(inv -> {
            AuthorizeUrlRequest req = inv.getArgument(1);
            return new AuthorizeUrlResponse("https://provider.example/oauth?state=" + req.state()
                    + "&code_challenge=" + req.codeChallenge());
        });
        when(gateway.providers()).thenReturn(new ProvidersResponse(List.of()));
    }

    @Test
    void multiIdentityConnectionStoresEncryptedTokensAndRequiresReconnectOnInvalidGrant() throws Exception {
        when(gateway.sync(any(), any())).thenThrow(new GatewayException(GatewayException.Category.AUTH_INVALID,
                "invalid_grant", "The provider rejected the token", null));
        when(gateway.revoke(eq(Provider.INSTAGRAM), any())).thenReturn(new RevokeResponse(true, true, null));

        Started s = start();
        ArgumentCaptor<AuthorizeUrlRequest> captor = ArgumentCaptor.forClass(AuthorizeUrlRequest.class);
        verify(gateway).authorizeUrl(eq(Provider.INSTAGRAM), captor.capture());
        assertThat(captor.getValue().redirectUri()).isEqualTo("http://localhost:5173/oauth/instagram/callback");

        JsonNode resolved = internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", s.state()), 200);
        assertThat(Hashing.pkceChallenge(resolved.get("codeVerifier").asText())).isEqualTo(captor.getValue().codeChallenge());
        // A state can only be redeemed once.
        internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", s.state()), 409);

        String id1 = "ig-" + UUID.randomUUID();
        String id2 = "ig-" + UUID.randomUUID();
        JsonNode completed = internal("/internal/v1/oauth/sessions/" + s.sessionId() + "/complete", Map.of(
                "tokens", Map.of("accessToken", ACCESS_TOKEN, "tokenType", "bearer",
                        "scopes", List.of("instagram_business_basic", "instagram_business_manage_insights"),
                        "expiresInSeconds", 5_184_000),
                "identities", List.of(identity(id1, "studio.one", true), identity(id2, "studio.two", true)),
                "capabilities", List.of("PROFILE_READ", "ACCOUNT_METRICS", "PUBLISHING")), 200);
        assertThat(completed.get("status").asText()).isEqualTo("AWAITING_SELECTION");
        assertThat(completed.get("returnPath").asText()).contains(s.sessionId());

        Response session = call(PERSONAL, GET, "/api/v1/connections/sessions/" + s.sessionId(), null);
        assertThat(session.body().get("candidates")).hasSize(2);
        assertThat(session.raw()).doesNotContain(ACCESS_TOKEN);

        Response selected = call(PERSONAL, POST, "/api/v1/connections/sessions/" + s.sessionId() + "/select",
                Map.of("providerAccountIds", List.of(id1)));
        assertThat(selected.body().get("status").asText()).isEqualTo("COMPLETED");
        String accountId = selected.body().get("connectedAccountIds").get(0).asText();

        String ciphertext = jdbc.queryForObject(
                "SELECT access_token_ciphertext FROM provider_token_credential WHERE account_id = ?::uuid", String.class, accountId);
        assertThat(ciphertext).startsWith("v1:").doesNotContain(ACCESS_TOKEN);

        // The initial sync ran after commit and the provider answered invalid_grant: reconnect required, no retry.
        Response account = call(PERSONAL, GET, "/api/v1/accounts/" + accountId, null);
        assertThat(account.raw()).doesNotContain(ACCESS_TOKEN).doesNotContain(ciphertext);
        assertThat(account.body().get("dataMode").asText()).isEqualTo("LIVE");
        assertThat(account.body().get("connectionStatus").asText()).isEqualTo("EXPIRED");
        assertThat(account.body().get("needsReconnect").asBoolean()).isTrue();
        assertThat(account.body().get("capabilities").toString()).doesNotContain("PUBLISHING");
        assertThat(account.body().get("latestJob").get("nextRetryAt").isNull()).isTrue();
        assertThat(call(PERSONAL, POST, "/api/v1/accounts/" + accountId + "/sync", null).code()).isEqualTo("RECONNECT_REQUIRED");

        Response disconnected = call(PERSONAL, POST, "/api/v1/accounts/" + accountId + "/disconnect", Map.of("deleteHistory", false));
        assertThat(disconnected.body().get("revocation").asText()).isEqualTo("REVOKED");
        assertThat(disconnected.body().get("historyRetained").asBoolean()).isTrue();
        verify(gateway).revoke(eq(Provider.INSTAGRAM), any());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM provider_token_credential WHERE account_id = ?::uuid",
                Integer.class, accountId)).isZero();
    }

    @Test
    void personalAccountsAreRejectedWithTheProvidersReason() throws Exception {
        Started s = start();
        internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", s.state()), 200);
        JsonNode completed = internal("/internal/v1/oauth/sessions/" + s.sessionId() + "/complete", Map.of(
                "tokens", Map.of("accessToken", ACCESS_TOKEN, "scopes", List.of("instagram_business_basic")),
                "identities", List.of(Map.of("providerAccountId", "personal-1", "handle", "me", "eligible", false,
                        "ineligibleReason", "Only Business or Creator accounts can be connected.")),
                "capabilities", List.of()), 200);
        assertThat(completed.get("status").asText()).isEqualTo("FAILED");
        Response session = call(PERSONAL, GET, "/api/v1/connections/sessions/" + s.sessionId(), null);
        assertThat(session.body().get("errorCode").asText()).isEqualTo("NO_ELIGIBLE_ACCOUNT");
        assertThat(session.body().get("errorMessage").asText()).contains("Business or Creator");
    }

    @Test
    void deniedConsentAndTamperedStateAreHandled() throws Exception {
        Started s = start();
        JsonNode failed = internal("/internal/v1/oauth/sessions/fail", Map.of("provider", "instagram", "state", s.state(),
                "errorCode", "access_denied", "errorMessage", "The user denied the request"), 200);
        assertThat(failed.get("status").asText()).isEqualTo("FAILED");

        JsonNode tampered = internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", "forged"), 400);
        assertThat(tampered.get("code").asText()).isEqualTo("STATE_INVALID");

        Started yt = start("youtube");
        JsonNode wrongProvider = internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", yt.state()), 400);
        assertThat(wrongProvider.get("code").asText()).isEqualTo("STATE_PROVIDER_MISMATCH");
        verify(gateway, never()).sync(any(), any());
    }

    @Test
    void providerWebhookDeauthorizationRevokesTheAccount() throws Exception {
        Started s = start();
        internal("/internal/v1/oauth/sessions/resolve", Map.of("provider", "instagram", "state", s.state()), 200);
        when(gateway.sync(any(), any())).thenReturn(new SyncResult(null, null, List.of(), List.of(), Map.of(), true, List.of()));
        String pid = "ig-" + UUID.randomUUID();
        internal("/internal/v1/oauth/sessions/" + s.sessionId() + "/complete", Map.of(
                "tokens", Map.of("accessToken", ACCESS_TOKEN, "scopes", List.of("instagram_business_basic")),
                "identities", List.of(identity(pid, "studio.three", true)), "capabilities", List.of("PROFILE_READ")), 200);

        JsonNode outcome = internal("/internal/v1/accounts/deauthorized", Map.of("provider", "INSTAGRAM", "providerAccountId", pid), 200);
        assertThat(outcome.get("matched").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("SELECT connection_status FROM connected_social_account WHERE provider_account_id = ?",
                String.class, pid)).isEqualTo("REVOKED");
    }

    // ---------------------------------------------------------------- helpers

    private record Started(String sessionId, String state) {}

    private Started start() throws Exception {
        return start("instagram");
    }

    private Started start(String provider) throws Exception {
        Response r = call(PERSONAL, POST, "/api/v1/connections/" + provider + "/start", null);
        assertThat(r.status()).as(r.raw()).isEqualTo(200);
        String url = r.body().get("authorizationUrl").asText();
        String state = UriComponentsBuilder.fromUri(URI.create(url)).build().getQueryParams().getFirst("state");
        return new Started(r.body().get("sessionId").asText(), state);
    }

    private static Map<String, Object> identity(String id, String handle, boolean eligible) {
        return Map.of("providerAccountId", id, "handle", handle, "displayName", handle, "accountType", "BUSINESS",
                "eligible", eligible);
    }

    private JsonNode internal(String path, Object body, int expectedStatus) throws Exception {
        var res = mvc.perform(post(path).header(InternalTokenFilter.HEADER, "test-internal-token")
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andReturn().getResponse();
        assertThat(res.getStatus()).as(res.getContentAsString()).isEqualTo(expectedStatus);
        return json.readTree(res.getContentAsString());
    }
}
