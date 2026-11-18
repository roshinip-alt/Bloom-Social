package com.bloom;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.*;

import com.bloom.support.ApiTest;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.Test;

/** End-to-end API behaviour for the product modules against the real schema and the seeded demo workspace. */
class ProductApiTest extends ApiTest {

    @Test
    void dashboardAggregatesOnlyLikeMetricsAndReportsSyncHealth() throws Exception {
        Response r = call(GET, "/api/v1/dashboard", null);
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.body().get("demoWorkspace").asBoolean()).isTrue();
        assertThat(r.body().get("accounts")).hasSize(4);
        assertThat(stream(r.body().get("accounts")).map(a -> a.get("syncState").asText())).contains("FRESH", "NEEDS_RECONNECT");

        JsonNode followers = stream(r.body().get("headline")).filter(a -> a.get("canonicalKey").asText().equals("followers"))
                .findFirst().orElseThrow();
        // Instagram (active) + TikTok contribute; the YouTube channel reports subscribers instead.
        assertThat(followers.get("contributors").size()).isGreaterThanOrEqualTo(2);
        assertThat(stream(followers.get("notReportedBy")).map(a -> a.get("provider").asText())).containsOnly("YOUTUBE");
        assertThat(r.body().get("topContent").size()).isGreaterThan(0);
        assertThat(r.body().get("upcomingTasks").size()).isGreaterThan(0);
    }

    @Test
    void audienceExplainsUnavailableDimensionsInsteadOfEstimating() throws Exception {
        UUID tiktok = accountId("TIKTOK");
        Response r = call(GET, "/api/v1/audience?accountId=" + tiktok, null);
        assertThat(r.status()).isEqualTo(200);
        JsonNode age = stream(r.body().get("dimensions")).filter(d -> d.get("dimension").asText().equals("age")).findFirst().orElseThrow();
        assertThat(age.get("availability").asText()).isEqualTo("NOT_SUPPORTED");
        assertThat(age.get("buckets")).isEmpty();

        Response ig = call(GET, "/api/v1/audience?accountId=" + accountId("INSTAGRAM"), null);
        JsonNode country = stream(ig.body().get("dimensions")).filter(d -> d.get("dimension").asText().equals("country")).findFirst().orElseThrow();
        assertThat(country.get("availability").asText()).isEqualTo("AVAILABLE");
        assertThat(country.get("source").asText()).isEqualTo("demo-generator");
    }

    @Test
    void completingARecurringTaskSchedulesTheNextOccurrence() throws Exception {
        LocalDate today = LocalDate.parse(call(GET, "/api/v1/planly/calendar", null).body().get("today").asText());
        Response created = call(POST, "/api/v1/planly/tasks", Map.of("title", "Weekly upload check", "dueDate", today.toString(),
                "recurrence", "WEEKLY", "priority", "HIGH"));
        assertThat(created.status()).isEqualTo(201);
        String id = created.body().get("id").asText();
        call(POST, "/api/v1/planly/tasks/" + id + "/subtasks", Map.of("title", "Check thumbnails"));

        Response done = call(PATCH, "/api/v1/planly/tasks/" + id + "/status", Map.of("status", "DONE"));
        assertThat(done.body().get("task").get("status").asText()).isEqualTo("DONE");
        JsonNode next = done.body().get("nextOccurrence");
        assertThat(next.get("dueDate").asText()).isEqualTo(today.plusWeeks(1).toString());
        assertThat(next.get("subtasks").get(0).get("title").asText()).isEqualTo("Check thumbnails");

        Response moved = call(PATCH, "/api/v1/planly/tasks/" + next.get("id").asText() + "/schedule",
                Map.of("dueDate", today.plusDays(9).toString()));
        assertThat(moved.body().get("dueDate").asText()).isEqualTo(today.plusDays(9).toString());
    }

    @Test
    void notesAutosaveWithVersionConflictDetection() throws Exception {
        String date = "2031-03-04";
        Response first = call(PUT, "/api/v1/planly/days/" + date + "/note", Map.of("body", "Draft", "version", -1));
        assertThat(first.status()).isEqualTo(200);
        int version = first.body().get("version").asInt();
        Response second = call(PUT, "/api/v1/planly/days/" + date + "/note", Map.of("body", "Draft v2", "version", version));
        assertThat(second.status()).isEqualTo(200);
        Response stale = call(PUT, "/api/v1/planly/days/" + date + "/note", Map.of("body", "Old tab", "version", version));
        assertThat(stale.status()).isEqualTo(409);
        assertThat(stale.code()).isEqualTo("STALE_VERSION");
        assertThat(call(GET, "/api/v1/planly/days/" + date, null).body().get("note").get("body").asText()).isEqualTo("Draft v2");
    }

    @Test
    void validationErrorsListTheFields() throws Exception {
        Response r = call(POST, "/api/v1/planly/tasks", Map.of("title", ""));
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.code()).isEqualTo("VALIDATION_FAILED");
        assertThat(r.body().get("fieldErrors").get(0).get("field").asText()).isEqualTo("title");
        assertThat(r.body().get("correlationId").asText()).isNotBlank();
    }

    @Test
    void goalsSupportManualProgressAndProtectAnalyticsLinkedProgress() throws Exception {
        Response goal = call(POST, "/api/v1/goals", Map.of("title", "Ship 10 shorts", "category", "CONTENT", "unit", "shorts",
                "targetValue", 10, "startDate", LocalDate.now().minusDays(5).toString(),
                "deadline", LocalDate.now().plusDays(30).toString()));
        assertThat(goal.status()).isEqualTo(201);
        String id = goal.body().get("id").asText();
        Response progressed = call(POST, "/api/v1/goals/" + id + "/progress", Map.of("value", 4, "note", "Batch one"));
        assertThat(progressed.body().get("currentValue").decimalValue()).isEqualByComparingTo("4");
        assertThat(progressed.body().get("progressPercent").decimalValue()).isEqualByComparingTo("40");
        call(POST, "/api/v1/goals/" + id + "/milestones", Map.of("title", "Half way", "targetValue", 5));
        assertThat(call(GET, "/api/v1/goals/" + id, null).body().get("milestones")).hasSize(1);

        JsonNode linked = stream(call(GET, "/api/v1/goals", null).body())
                .filter(g -> g.get("progressSource").asText().equals("ANALYTICS")).findFirst().orElseThrow();
        assertThat(linked.get("linkedMetric").get("available").asBoolean()).isTrue();
        Response manual = call(POST, "/api/v1/goals/" + linked.get("id").asText() + "/progress", Map.of("value", 1));
        assertThat(manual.status()).isEqualTo(409);
        assertThat(manual.code()).isEqualTo("PROGRESS_IS_ANALYTICS_LINKED");
    }

    @Test
    void contentIsVersionedAndOnlyPublishedWhenRecorded() throws Exception {
        Response draft = call(POST, "/api/v1/content/drafts", Map.of("title", "Compost myths", "platform", "YOUTUBE",
                "contentType", "VIDEO", "caption", "v1", "hashtags", List.of("#compost", "Compost")));
        assertThat(draft.status()).isEqualTo(201);
        assertThat(draft.body().get("hashtags")).hasSize(1);
        String id = draft.body().get("id").asText();
        Response edited = call(PUT, "/api/v1/content/drafts/" + id, Map.of("title", "Compost myths", "platform", "YOUTUBE",
                "contentType", "VIDEO", "caption", "v2", "changeSummary", "Tighter caption"));
        assertThat(edited.status()).as(edited.raw()).isEqualTo(200);
        assertThat(edited.body().get("currentVersion").asInt()).isEqualTo(2);
        assertThat(call(GET, "/api/v1/content/drafts/" + id + "/versions", null).body()).hasSize(2);

        Response direct = call(PATCH, "/api/v1/content/drafts/" + id + "/stage", Map.of("stage", "PUBLISHED"));
        assertThat(direct.status()).isEqualTo(400);
        assertThat(direct.code()).isEqualTo("PUBLISH_REQUIRES_RECORD");

        Response future = call(POST, "/api/v1/content/drafts/" + id + "/publication",
                Map.of("publishedAt", Instant.now().plus(1, ChronoUnit.DAYS).toString()));
        assertThat(future.status()).isEqualTo(400);
        Response recorded = call(POST, "/api/v1/content/drafts/" + id + "/publication",
                Map.of("publishedAt", Instant.now().minus(1, ChronoUnit.HOURS).toString(), "publishedUrl", "https://youtu.be/x"));
        assertThat(recorded.body().get("stage").asText()).isEqualTo("PUBLISHED");
        assertThat(recorded.body().get("publicationSource").asText()).isEqualTo("MANUAL");

        Response variants = call(POST, "/api/v1/content/drafts/" + id + "/repurpose", Map.of("variants",
                List.of(Map.of("platform", "TIKTOK", "contentType", "VIDEO"), Map.of("platform", "INSTAGRAM", "contentType", "REEL"))));
        assertThat(variants.status()).isEqualTo(201);
        assertThat(variants.body()).hasSize(2);
        assertThat(variants.body().get(0).get("stage").asText()).isEqualTo("SCRIPT");

        Response restored = call(POST, "/api/v1/content/drafts/" + id + "/versions/1/restore", null);
        assertThat(restored.body().get("caption").asText()).isEqualTo("v1");
        assertThat(restored.body().get("currentVersion").asInt()).isEqualTo(3);
    }

    @Test
    void earningsAreTrackedPerCurrencyAndNeverMixed() throws Exception {
        Response brand = call(POST, "/api/v1/brands", Map.of("brandName", "Test Brand", "email", "a@b.example"));
        assertThat(brand.status()).isEqualTo(201);
        Response campaign = call(POST, "/api/v1/campaigns", Map.of("brandContactId", brand.body().get("id").asText(),
                "name", "Launch", "stage", "CONFIRMED", "agreedAmount", 1000, "currency", "CHF"));
        assertThat(campaign.status()).isEqualTo(201);
        String cid = campaign.body().get("id").asText();
        Response wrongCurrency = call(POST, "/api/v1/campaigns/" + cid + "/payments", Map.of("amount", 100, "currency", "USD"));
        assertThat(wrongCurrency.status()).isEqualTo(400);
        assertThat(wrongCurrency.code()).isEqualTo("CURRENCY_MISMATCH");
        call(POST, "/api/v1/campaigns/" + cid + "/payments", Map.of("amount", 400, "paidDate", LocalDate.now().minusDays(1).toString()));

        JsonNode chf = stream(call(GET, "/api/v1/earnings/summary?year=" + LocalDate.now().minusDays(1).getYear(), null)
                .body().get("currencies")).filter(c -> c.get("currency").asText().equals("CHF")).findFirst().orElseThrow();
        assertThat(chf.get("paidInYear").decimalValue()).isEqualByComparingTo("400");
        assertThat(chf.get("committedUnpaid").decimalValue()).isEqualByComparingTo("600");

        Response blocked = call(DELETE, "/api/v1/brands/" + brand.body().get("id").asText(), null);
        assertThat(blocked.status()).isEqualTo(409);
        assertThat(blocked.code()).isEqualTo("BRAND_HAS_CAMPAIGNS");
    }

    @Test
    void demoAndLiveDataStaySeparate() throws Exception {
        Response connectInDemo = call(POST, "/api/v1/connections/instagram/start", null);
        assertThat(connectInDemo.status()).isEqualTo(409);
        assertThat(connectInDemo.code()).isEqualTo("DEMO_WORKSPACE");

        Response demoInPersonal = call(PERSONAL, POST, "/api/v1/connections/instagram/demo", null);
        assertThat(demoInPersonal.status()).isEqualTo(409);
        assertThat(demoInPersonal.code()).isEqualTo("NOT_DEMO_WORKSPACE");

        Response resetPersonal = call(PERSONAL, POST, "/api/v1/workspaces/current/demo-reset", null);
        assertThat(resetPersonal.status()).isEqualTo(409);

        assertThat(call(UUID.randomUUID(), GET, "/api/v1/dashboard", null).status()).isEqualTo(404);
        assertThat(stream(call(PERSONAL, GET, "/api/v1/accounts", null).body()).map(a -> a.get("dataMode").asText()))
                .doesNotContain("DEMO");
    }

    @Test
    void internalEndpointsRequireTheServiceToken() throws Exception {
        int status = mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .post("/internal/v1/oauth/sessions/resolve").contentType("application/json")
                .content("{\"provider\":\"instagram\",\"state\":\"x\"}")).andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(401);
    }

    private UUID accountId(String provider) throws Exception {
        return stream(call(GET, "/api/v1/accounts", null).body())
                .filter(a -> a.get("provider").asText().equals(provider) && a.get("connectionStatus").asText().equals("ACTIVE"))
                .map(a -> UUID.fromString(a.get("id").asText())).findFirst().orElseThrow();
    }

    private static java.util.stream.Stream<JsonNode> stream(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false);
    }
}
