package com.bloom.social.account;

import com.bloom.social.domain.Capability;
import com.bloom.social.domain.Provider;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Product-facing description of each provider: what Bloom requests, why, prerequisites, and what is NOT available.
 * Facts mirror docs/integrations/*.md (checked 2026-11-11; TikTok unverified).
 */
@Component
public class ProviderCatalog {
    public record Descriptor(Provider provider, String displayName, String apiFamily, String docsPath,
                             List<String> requestedScopes, Set<Capability> supportedCapabilities,
                             List<String> dataAccessed, List<String> notAvailable, List<String> prerequisites,
                             String accessExplanation, boolean docsVerified) {}

    private final Map<Provider, Descriptor> descriptors = Map.of(
            Provider.INSTAGRAM, new Descriptor(Provider.INSTAGRAM, "Instagram", "Instagram API with Instagram Login",
                    "docs/integrations/instagram.md",
                    List.of("instagram_business_basic", "instagram_business_manage_insights"),
                    EnumSet.of(Capability.PROFILE_READ, Capability.ACCOUNT_METRICS, Capability.CONTENT_LIST,
                            Capability.CONTENT_METRICS, Capability.AUDIENCE_INSIGHTS, Capability.TOKEN_REFRESH),
                    List.of("Profile: username, name, picture, followers, media count",
                            "Daily account insights: reach, views, accounts engaged, interactions",
                            "Your posts and their insights (reach, views, likes, comments, saves, shares)",
                            "Follower demographics (age, gender, country, city) when you have 100+ followers"),
                    List.of("Personal (non-professional) accounts", "Direct messages", "Publishing",
                            "Impressions (deprecated by Meta in 2025)", "Insights older than Meta retains (2 years)"),
                    List.of("An Instagram Business or Creator (professional) account",
                            "Until Meta App Review grants Advanced Access, the account must be added as a tester on the Meta app"),
                    "Bloom will send you to Instagram to approve read-only access to your professional profile, media and insights. "
                            + "Bloom cannot post, comment or read messages. Tokens are encrypted and stay on the server.",
                    true),
            Provider.YOUTUBE, new Descriptor(Provider.YOUTUBE, "YouTube", "YouTube Data API v3 + YouTube Analytics API",
                    "docs/integrations/youtube.md",
                    List.of("https://www.googleapis.com/auth/youtube.readonly",
                            "https://www.googleapis.com/auth/yt-analytics.readonly"),
                    EnumSet.of(Capability.PROFILE_READ, Capability.ACCOUNT_METRICS, Capability.CONTENT_LIST,
                            Capability.CONTENT_METRICS, Capability.AUDIENCE_INSIGHTS, Capability.TOKEN_REFRESH),
                    List.of("Channel identity and public statistics (subscribers, views, video count)",
                            "Your uploads and their public statistics",
                            "Private daily analytics: views, watch time, likes, comments, shares, subscribers gained/lost",
                            "Viewer age/gender (logged-in viewers) and views by country"),
                    List.of("Uploading or managing videos", "Revenue / monetary metrics",
                            "Same-day analytics (YouTube reports are delayed)"),
                    List.of("A Google account that owns or manages a YouTube channel",
                            "While the Google OAuth app is in Testing, your Google account must be a listed test user"),
                    "Bloom will send you to Google to approve read-only access to your YouTube channel and its analytics. "
                            + "Bloom requests offline access so it can refresh data in the background. It cannot upload or edit anything.",
                    true),
            Provider.TIKTOK, new Descriptor(Provider.TIKTOK, "TikTok", "TikTok Login Kit + Display API",
                    "docs/integrations/tiktok.md",
                    List.of("user.info.basic", "user.info.profile", "user.info.stats", "video.list"),
                    EnumSet.of(Capability.PROFILE_READ, Capability.ACCOUNT_METRICS, Capability.CONTENT_LIST,
                            Capability.CONTENT_METRICS, Capability.TOKEN_REFRESH),
                    List.of("Profile: display name, avatar, username",
                            "Follower, like and video counts (if user.info.stats is approved)",
                            "Your public videos with view, like, comment and share counters"),
                    List.of("Reach, impressions and watch time", "Audience demographics", "Full post analytics",
                            "Publishing"),
                    List.of("A TikTok account", "TikTok app review of each scope (or the account added as a Sandbox target user)"),
                    "Bloom will send you to TikTok to approve read-only access to your profile and public videos. "
                            + "The TikTok Display API does not provide analytics such as reach or demographics.",
                    false));

    public Descriptor get(Provider p) {
        return descriptors.get(p);
    }

    public List<Descriptor> all() {
        return List.of(get(Provider.INSTAGRAM), get(Provider.YOUTUBE), get(Provider.TIKTOK));
    }
}
