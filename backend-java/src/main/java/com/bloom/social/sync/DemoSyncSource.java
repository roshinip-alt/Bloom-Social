package com.bloom.social.sync;

import com.bloom.social.domain.Availability;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.DataMode;
import com.bloom.social.domain.Provider;
import com.bloom.social.gateway.GatewayDtos.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import org.springframework.stereotype.Component;

/**
 * DEMO accounts: deterministic, clearly synthetic data (seeded from the account id) shaped like each provider's
 * real capability set — TikTok gets no reach/demographics because the Display API has none. Every row is stored
 * with is_demo = true and source_endpoint "demo-generator".
 */
@Component
public class DemoSyncSource implements SyncSource {
    public static final String SOURCE = "demo-generator";
    private static final String[] TITLES = {
            "Slow mornings: my 6am planning ritual", "Studio tour — the corner I edit in", "Five tools I actually use daily",
            "Behind the shoot: autumn lookbook", "What a week of batching content looks like", "Answering your questions about rates",
            "Desk reset in 60 seconds", "How I plan a month of posts", "Testing a new lighting setup",
            "Day in the life: launch week", "Notes app → finished script", "Editing a reel start to finish",
            "Cafe working session vlog", "Why I post less (and grow more)", "Packing list for a brand trip",
            "Small habits that keep me consistent", "Reacting to my first ever video", "Collab day with a fellow creator",
            "Rainy day recipe I keep making", "Quiet productivity playlist"};

    @Override
    public boolean supports(ConnectedSocialAccount account) {
        return account.getDataMode() == DataMode.DEMO;
    }

    @Override
    public SyncResult fetch(SyncContext ctx) {
        ConnectedSocialAccount a = ctx.account();
        Random rnd = new Random(a.getId().getMostSignificantBits() ^ a.getId().getLeastSignificantBits());
        List<MetricPoint> metrics = new ArrayList<>();
        List<PostData> posts = new ArrayList<>();
        switch (a.getProvider()) {
            case INSTAGRAM -> instagram(ctx, rnd, metrics, posts);
            case YOUTUBE -> youtube(ctx, rnd, metrics, posts);
            case TIKTOK -> tiktok(ctx, rnd, metrics, posts);
        }
        return new SyncResult(null, null, metrics, posts, Map.of("demo", true), true, List.of());
    }

    // ---------------------------------------------------------------- providers

    private void instagram(SyncContext ctx, Random rnd, List<MetricPoint> m, List<PostData> posts) {
        LocalDate start = ctx.today().minusDays(119);
        double followers = 14_000 + rnd.nextInt(8_000);
        for (LocalDate d = start; !d.isAfter(ctx.until()); d = d.plusDays(1)) {
            double wave = 1 + 0.25 * Math.sin(d.toEpochDay() / 6.0);
            followers += 8 + rnd.nextInt(45) * wave;
            stock(m, "instagram.followers_count", d, followers);
            stock(m, "instagram.media_count", d, 300 + (d.toEpochDay() - start.toEpochDay()) / 3.0);
            double reach = (2_500 + rnd.nextInt(4_000)) * wave;
            flow(m, "instagram.reach", d, reach);
            flow(m, "instagram.views", d, reach * (2.1 + rnd.nextDouble()));
            double engaged = reach * (0.08 + rnd.nextDouble() * 0.05);
            flow(m, "instagram.accounts_engaged", d, engaged);
            double likes = engaged * 1.6;
            flow(m, "instagram.likes", d, likes);
            flow(m, "instagram.comments", d, likes * 0.06);
            flow(m, "instagram.shares", d, likes * 0.09);
            flow(m, "instagram.saves", d, likes * 0.12);
            flow(m, "instagram.total_interactions", d, likes * 1.27);
        }
        demographics(m, "instagram.follower_demographics", ctx.today(), "LIFETIME", followers, rnd,
                Map.of("age", new String[]{"13-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"},
                        "gender", new String[]{"F", "M", "U"},
                        "country", new String[]{"US", "GB", "CA", "DE", "AU", "IN", "FR"}));
        String[] types = {"REEL", "POST", "CAROUSEL", "REEL"};
        posts(ctx, rnd, posts, 3, types, (type, age, r) -> {
            double reach = (3_000 + r.nextInt(12_000)) * (type.equals("REEL") ? 1.8 : 1.0);
            List<PostMetric> pm = new ArrayList<>();
            pm.add(pmetric("instagram.post.reach", reach));
            pm.add(pmetric("instagram.post.views", reach * 2.4));
            pm.add(pmetric("instagram.post.likes", reach * 0.07));
            pm.add(pmetric("instagram.post.comments", reach * 0.004));
            pm.add(pmetric("instagram.post.saved", reach * 0.01));
            pm.add(pmetric("instagram.post.shares", reach * 0.006));
            return pm;
        }, "https://www.instagram.com/p/demo-");
    }

    private void youtube(SyncContext ctx, Random rnd, List<MetricPoint> m, List<PostData> posts) {
        LocalDate start = ctx.today().minusDays(119);
        double subs = 42_000 + rnd.nextInt(10_000);
        double lifetimeViews = 3_800_000;
        LocalDate analyticsUntil = ctx.until().minusDays(2); // YouTube Analytics reports are delayed ~2-3 days
        for (LocalDate d = start; !d.isAfter(ctx.until()); d = d.plusDays(1)) {
            double wave = 1 + 0.3 * Math.sin(d.toEpochDay() / 9.0);
            double views = (9_000 + rnd.nextInt(7_000)) * wave;
            int gained = 40 + rnd.nextInt(90);
            int lost = 5 + rnd.nextInt(25);
            subs += gained - lost;
            lifetimeViews += views;
            stock(m, "youtube.subscriber_count", d, roundSig3(subs));
            stock(m, "youtube.channel_view_count", d, lifetimeViews);
            stock(m, "youtube.video_count", d, 180 + (d.toEpochDay() - start.toEpochDay()) / 7.0);
            if (!d.isAfter(analyticsUntil)) {
                flow(m, "youtube.views", d, views);
                flow(m, "youtube.estimated_minutes_watched", d, views * (3.2 + rnd.nextDouble()));
                stock(m, "youtube.average_view_duration", d, 190 + rnd.nextInt(80));
                flow(m, "youtube.likes", d, views * 0.041);
                flow(m, "youtube.comments", d, views * 0.0035);
                flow(m, "youtube.shares", d, views * 0.0022);
                flow(m, "youtube.subscribers_gained", d, gained);
                flow(m, "youtube.subscribers_lost", d, lost);
            }
        }
        // viewerPercentage by ageGroup × gender over the trailing 28 days; percentages sum to 100.
        String[] ages = {"age13-17", "age18-24", "age25-34", "age35-44", "age45-54", "age55-64", "age65-"};
        String[] genders = {"female", "male", "user_specified"};
        double[] w = new double[ages.length * genders.length];
        double total = 0;
        for (int i = 0; i < w.length; i++) {
            int age = i / genders.length;
            int g = i % genders.length;
            w[i] = (age == 2 ? 9 : age == 1 ? 7 : age == 3 ? 5 : 1.5) * (g == 2 ? 0.05 : 1) * (0.7 + rnd.nextDouble() * 0.6);
            total += w[i];
        }
        for (int i = 0; i < w.length; i++) {
            Map<String, String> dims = new LinkedHashMap<>();
            dims.put("ageGroup", ages[i / genders.length]);
            dims.put("gender", genders[i % genders.length]);
            m.add(new MetricPoint("youtube.viewer_percentage", ctx.today(), "PERIOD_28D", dims,
                    scale(w[i] / total * 100, 2), Availability.AVAILABLE, SOURCE, null));
        }
        String[] countries = {"US", "GB", "IN", "CA", "DE", "AU", "PH", "BR"};
        double cw = 120_000;
        for (String c : countries) {
            m.add(new MetricPoint("youtube.views_by_country", ctx.today(), "PERIOD_28D", Map.of("country", c),
                    scale(cw, 0), Availability.AVAILABLE, SOURCE, null));
            cw *= 0.45 + rnd.nextDouble() * 0.2;
        }
        posts(ctx, rnd, posts, 4, new String[]{"VIDEO", "SHORT"}, (type, age, r) -> {
            double v = (type.equals("SHORT") ? 20_000 : 8_000) + r.nextInt(40_000);
            return List.of(pmetric("youtube.post.views", v), pmetric("youtube.post.likes", v * 0.04),
                    pmetric("youtube.post.comments", v * 0.003));
        }, "https://www.youtube.com/watch?v=demo-");
    }

    private void tiktok(SyncContext ctx, Random rnd, List<MetricPoint> m, List<PostData> posts) {
        LocalDate start = ctx.today().minusDays(119);
        double followers = 26_000 + rnd.nextInt(9_000);
        double likes = 900_000;
        for (LocalDate d = start; !d.isAfter(ctx.until()); d = d.plusDays(1)) {
            followers += 15 + rnd.nextInt(120);
            likes += 2_000 + rnd.nextInt(9_000);
            stock(m, "tiktok.follower_count", d, followers);
            stock(m, "tiktok.likes_count", d, likes);
            stock(m, "tiktok.video_count", d, 210 + (d.toEpochDay() - start.toEpochDay()) / 2.5);
        }
        posts(ctx, rnd, posts, 2, new String[]{"VIDEO"}, (type, age, r) -> {
            double v = 6_000 + r.nextInt(90_000);
            return List.of(pmetric("tiktok.post.view_count", v), pmetric("tiktok.post.like_count", v * 0.09),
                    pmetric("tiktok.post.comment_count", v * 0.004), pmetric("tiktok.post.share_count", v * 0.006));
        }, "https://www.tiktok.com/@demo/video/demo-");
    }

    // ---------------------------------------------------------------- helpers

    interface PostMetrics {
        List<PostMetric> make(String type, long ageDays, Random rnd);
    }

    private static void posts(SyncContext ctx, Random rnd, List<PostData> out, int everyDays, String[] types,
                              PostMetrics metrics, String linkPrefix) {
        int i = 0;
        for (LocalDate d = ctx.today().minusDays(110); d.isBefore(ctx.today()); d = d.plusDays(everyDays + rnd.nextInt(2))) {
            String type = types[i % types.length];
            String id = ctx.account().getProvider().slug() + "-" + d;
            String title = TITLES[(i * 7 + ctx.account().getProvider().ordinal() * 3) % TITLES.length];
            out.add(new PostData(id, type, title, linkPrefix + id, null,
                    d.atTime(LocalTime.of(9 + rnd.nextInt(10), rnd.nextInt(60))).toInstant(ZoneOffset.UTC),
                    durationSeconds(type, rnd),
                    metrics.make(type, ctx.today().toEpochDay() - d.toEpochDay(), rnd)));
            i++;
        }
    }

    /** Video-like posts have a duration; images and carousels do not (null, not zero). */
    private static Integer durationSeconds(String type, Random rnd) {
        return switch (type) {
            case "SHORT", "REEL" -> 15 + rnd.nextInt(45);
            case "VIDEO" -> 300 + rnd.nextInt(900);
            default -> null;
        };
    }

    private static void demographics(List<MetricPoint> m, String key, LocalDate date, String window, double total,
                                     Random rnd, Map<String, String[]> breakdowns) {
        breakdowns.forEach((dim, values) -> {
            double[] w = new double[values.length];
            double sum = 0;
            for (int i = 0; i < w.length; i++) {
                w[i] = Math.pow(0.62, Math.abs(i - (dim.equals("age") ? 2 : 0))) * (0.8 + rnd.nextDouble() * 0.4);
                sum += w[i];
            }
            for (int i = 0; i < values.length; i++) {
                m.add(new MetricPoint(key, date, window, Map.of(dim, values[i]), scale(total * w[i] / sum, 0),
                        Availability.AVAILABLE, SOURCE, null));
            }
        });
    }

    private static void stock(List<MetricPoint> m, String key, LocalDate d, double v) {
        m.add(new MetricPoint(key, d, "DAY", Map.of(), scale(v, key.contains("average") ? 1 : 0), Availability.AVAILABLE, SOURCE, null));
    }

    private static void flow(List<MetricPoint> m, String key, LocalDate d, double v) {
        m.add(new MetricPoint(key, d, "DAY", Map.of(), scale(v, 0), Availability.AVAILABLE, SOURCE, null));
    }

    private static PostMetric pmetric(String key, double v) {
        return new PostMetric(key, scale(v, 0), Availability.AVAILABLE, SOURCE, null);
    }

    private static BigDecimal scale(double v, int digits) {
        return BigDecimal.valueOf(v).setScale(digits, RoundingMode.HALF_UP);
    }

    private static double roundSig3(double v) {
        if (v < 1000) return Math.floor(v);
        double mag = Math.pow(10, Math.floor(Math.log10(v)) - 2);
        return Math.floor(v / mag) * mag;
    }

    /** Capabilities a demo account of this provider mirrors (TikTok: no audience insights). */
    public static List<String> capabilitiesFor(Provider p) {
        List<String> caps = new ArrayList<>(List.of("PROFILE_READ", "ACCOUNT_METRICS", "CONTENT_LIST", "CONTENT_METRICS"));
        if (p != Provider.TIKTOK) caps.add("AUDIENCE_INSIGHTS");
        return caps;
    }
}
