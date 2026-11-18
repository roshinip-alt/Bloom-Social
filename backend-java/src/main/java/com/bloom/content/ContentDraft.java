package com.bloom.content;

import com.bloom.common.persistence.Timestamped;
import com.bloom.social.domain.Provider;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
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
 * A draft moving through Script → In production → Ready → Published. A draft is only PUBLISHED when the owner records
 * the publication (MANUAL) or links it to a synced provider post (VERIFIED_API); Bloom never publishes.
 */
@Entity
@Table(name = "content_draft")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContentDraft extends Timestamped {
    public enum Stage { SCRIPT, IN_PRODUCTION, READY, PUBLISHED }
    public enum ContentType { POST, CAROUSEL, REEL, STORY, SHORT, VIDEO, LIVE }
    public enum PublicationSource { MANUAL, VERIFIED_API }

    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Column(name = "idea_id")
    private UUID ideaId;
    @Column(name = "parent_draft_id")
    private UUID parentDraftId;
    private String title;
    @Enumerated(EnumType.STRING)
    private Provider platform;
    @Enumerated(EnumType.STRING)
    @Column(name = "content_type")
    private ContentType contentType;
    private String caption;
    private String script;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "hashtags", columnDefinition = "text[]")
    private List<String> hashtags = new ArrayList<>();
    private String notes;
    @Column(name = "planned_date")
    private LocalDate plannedDate;
    @Enumerated(EnumType.STRING)
    private Stage stage;
    @Column(name = "goal_id")
    private UUID goalId;
    @Column(name = "campaign_id")
    private UUID campaignId;
    @Column(name = "published_at")
    private Instant publishedAt;
    @Column(name = "published_url")
    private String publishedUrl;
    @Enumerated(EnumType.STRING)
    @Column(name = "publication_source")
    private PublicationSource publicationSource;
    @Column(name = "social_post_id")
    private UUID socialPostId;
    @Column(name = "current_version")
    private int currentVersion;

    public ContentDraft(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.stage = Stage.SCRIPT;
        this.currentVersion = 0;
    }

    public void recordPublication(PublicationSource source, Instant at, String url, UUID postId) {
        this.stage = Stage.PUBLISHED;
        this.publicationSource = source;
        this.publishedAt = at;
        this.publishedUrl = url;
        this.socialPostId = postId;
    }

    public void clearPublication() {
        this.stage = Stage.READY;
        this.publicationSource = null;
        this.publishedAt = null;
        this.publishedUrl = null;
        this.socialPostId = null;
    }
}
