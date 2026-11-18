package com.bloom.content;

import com.bloom.social.domain.Provider;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ContentDtos {
    private ContentDtos() {}

    public record IdeaRequest(@NotBlank @Size(max = 200) String title, @Size(max = 5000) String notes, Provider platform,
                              List<@NotBlank @Size(max = 40) String> tags) {}

    public record IdeaView(UUID id, String title, String notes, Provider platform, List<String> tags,
                           ContentIdea.Status status, Instant createdAt, Instant updatedAt) {
        static IdeaView of(ContentIdea i) {
            return new IdeaView(i.getId(), i.getTitle(), i.getNotes(), i.getPlatform(), List.copyOf(i.getTags()),
                    i.getStatus(), i.getCreatedAt(), i.getUpdatedAt());
        }
    }

    public record PromoteRequest(@NotNull Provider platform, @NotNull ContentDraft.ContentType contentType) {}

    public record DraftRequest(
            @NotBlank @Size(max = 200) String title,
            @NotNull Provider platform,
            @NotNull ContentDraft.ContentType contentType,
            @Size(max = 10_000) String caption,
            @Size(max = 50_000) String script,
            List<@NotBlank @Size(max = 100) String> hashtags,
            @Size(max = 10_000) String notes,
            LocalDate plannedDate,
            UUID goalId,
            UUID campaignId,
            @Size(max = 300) String changeSummary) {}

    /** Pipeline moves. PUBLISHED is not accepted here — use the publication endpoints. */
    public record StageRequest(@NotNull ContentDraft.Stage stage) {}

    /** The owner records that they published the draft themselves. */
    public record PublicationRequest(@NotNull Instant publishedAt, @Size(max = 1024) String publishedUrl) {}

    /** Verified publication: links a post that Bloom synced from the provider. */
    public record LinkPostRequest(@NotNull UUID socialPostId) {}

    public record RepurposeRequest(@NotEmpty List<@jakarta.validation.Valid Variant> variants) {
        public record Variant(@NotNull Provider platform, @NotNull ContentDraft.ContentType contentType) {}
    }

    public record DraftView(UUID id, UUID ideaId, UUID parentDraftId, String parentTitle, String title, Provider platform,
                            ContentDraft.ContentType contentType, String caption, String script, List<String> hashtags,
                            String notes, LocalDate plannedDate, ContentDraft.Stage stage, UUID goalId, String goalTitle,
                            UUID campaignId, String campaignName, Instant publishedAt, String publishedUrl,
                            ContentDraft.PublicationSource publicationSource, UUID socialPostId, int currentVersion,
                            int variantCount, Instant createdAt, Instant updatedAt) {}

    public record VersionView(UUID id, int versionNumber, ContentVersion.Snapshot snapshot, String changeSummary,
                              Instant createdAt) {
        static VersionView of(ContentVersion v) {
            return new VersionView(v.getId(), v.getVersionNumber(), v.getSnapshot(), v.getChangeSummary(), v.getCreatedAt());
        }
    }

    /** The board: open ideas plus drafts grouped by stage. */
    public record PipelineView(List<IdeaView> ideas, Map<ContentDraft.Stage, List<DraftView>> stages) {}

}
