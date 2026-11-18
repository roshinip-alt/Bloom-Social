package com.bloom.content;

import com.bloom.auth.CurrentWorkspace;
import com.bloom.common.persistence.Ids;
import com.bloom.content.ContentDtos.*;
import com.bloom.exception.BloomException;
import com.bloom.social.domain.ConnectedSocialAccount;
import com.bloom.social.domain.ConnectedSocialAccountRepository;
import java.time.Clock;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Content Studio. Every change to a draft's text writes a new {@link ContentVersion}; restoring an old version is
 * itself a new version, so history is append-only.
 */
@Service
@Transactional
public class ContentService {
    private final ContentIdeaRepository ideas;
    private final ContentDraftRepository drafts;
    private final ContentVersionRepository versions;
    private final ConnectedSocialAccountRepository accounts;
    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentWorkspace workspace;
    private final Clock clock;

    public ContentService(ContentIdeaRepository ideas, ContentDraftRepository drafts, ContentVersionRepository versions,
                          ConnectedSocialAccountRepository accounts, NamedParameterJdbcTemplate jdbc,
                          CurrentWorkspace workspace, Clock clock) {
        this.ideas = ideas;
        this.drafts = drafts;
        this.versions = versions;
        this.accounts = accounts;
        this.jdbc = jdbc;
        this.workspace = workspace;
        this.clock = clock;
    }

    // ---------------------------------------------------------------- ideas

    @Transactional(readOnly = true)
    public List<IdeaView> ideas(boolean includeArchived) {
        List<ContentIdea.Status> statuses = includeArchived
                ? List.of(ContentIdea.Status.values()) : List.of(ContentIdea.Status.OPEN, ContentIdea.Status.PROMOTED);
        return ideas.findByWorkspaceIdAndStatusInOrderByCreatedAtDesc(workspace.id(), statuses).stream().map(IdeaView::of).toList();
    }

    public IdeaView createIdea(IdeaRequest req) {
        ContentIdea i = new ContentIdea(Ids.newId(), workspace.id());
        applyIdea(i, req);
        return IdeaView.of(ideas.save(i));
    }

    public IdeaView updateIdea(UUID id, IdeaRequest req) {
        ContentIdea i = ownedIdea(id);
        applyIdea(i, req);
        return IdeaView.of(i);
    }

    public IdeaView setIdeaArchived(UUID id, boolean archived) {
        ContentIdea i = ownedIdea(id);
        i.setStatus(archived ? ContentIdea.Status.ARCHIVED : ContentIdea.Status.OPEN);
        return IdeaView.of(i);
    }

    public void deleteIdea(UUID id) {
        ideas.delete(ownedIdea(id));
    }

    /** Turns an idea into a draft at the Script stage. */
    public DraftView promote(UUID ideaId, PromoteRequest req) {
        ContentIdea i = ownedIdea(ideaId);
        ContentDraft d = new ContentDraft(Ids.newId(), workspace.id());
        d.setIdeaId(i.getId());
        d.setTitle(i.getTitle());
        d.setPlatform(req.platform());
        d.setContentType(req.contentType());
        d.setNotes(i.getNotes());
        drafts.save(d);
        snapshot(d, "Created from idea");
        i.setStatus(ContentIdea.Status.PROMOTED);
        return view(d);
    }

    // ---------------------------------------------------------------- drafts

    @Transactional(readOnly = true)
    public PipelineView pipeline() {
        List<IdeaView> open = ideas.findByWorkspaceIdAndStatusInOrderByCreatedAtDesc(workspace.id(), List.of(ContentIdea.Status.OPEN))
                .stream().map(IdeaView::of).toList();
        Map<ContentDraft.Stage, List<DraftView>> stages = new EnumMap<>(ContentDraft.Stage.class);
        for (ContentDraft.Stage s : ContentDraft.Stage.values()) stages.put(s, new ArrayList<>());
        views(drafts.findByWorkspaceIdOrderByPlannedDateAscCreatedAtAsc(workspace.id()))
                .forEach(v -> stages.get(v.stage()).add(v));
        return new PipelineView(open, stages);
    }

    @Transactional(readOnly = true)
    public DraftView get(UUID id) {
        return view(owned(id));
    }

    public DraftView create(DraftRequest req) {
        ContentDraft d = new ContentDraft(Ids.newId(), workspace.id());
        applyDraft(d, req);
        drafts.save(d);
        snapshot(d, summary(req, "Created"));
        return view(d);
    }

    public DraftView update(UUID id, DraftRequest req) {
        ContentDraft d = owned(id);
        ContentVersion.Snapshot before = snapshotOf(d);
        applyDraft(d, req);
        if (!before.equals(snapshotOf(d))) {
            snapshot(d, summary(req, "Edited"));
        }
        return view(d);
    }

    public DraftView moveStage(UUID id, ContentDraft.Stage stage) {
        if (stage == ContentDraft.Stage.PUBLISHED) {
            throw BloomException.badRequest("PUBLISH_REQUIRES_RECORD",
                    "Mark a draft published by recording the publication or linking a synced post");
        }
        ContentDraft d = owned(id);
        if (d.getStage() == ContentDraft.Stage.PUBLISHED) {
            d.clearPublication();
        }
        d.setStage(stage);
        return view(d);
    }

    public DraftView recordPublication(UUID id, PublicationRequest req) {
        ContentDraft d = owned(id);
        if (req.publishedAt().isAfter(clock.instant())) {
            throw BloomException.badRequest("PUBLISHED_IN_FUTURE", "The publication time cannot be in the future");
        }
        d.recordPublication(ContentDraft.PublicationSource.MANUAL, req.publishedAt(), blankToNull(req.publishedUrl()), null);
        return view(d);
    }

    /** Verified publication: the post must be a synced post from an account of the draft's platform. */
    public DraftView linkPost(UUID id, LinkPostRequest req) {
        ContentDraft d = owned(id);
        var rows = jdbc.queryForList("""
                SELECT p.account_id, p.permalink, p.published_at FROM social_post p
                JOIN connected_social_account a ON a.id = p.account_id
                WHERE p.id = :post AND a.workspace_id = :ws""",
                new MapSqlParameterSource("post", req.socialPostId()).addValue("ws", workspace.id()));
        if (rows.isEmpty()) throw BloomException.notFound("Synced post");
        Map<String, Object> row = rows.get(0);
        ConnectedSocialAccount a = accounts.findById((UUID) row.get("account_id")).orElseThrow();
        if (a.getProvider() != d.getPlatform()) {
            throw BloomException.badRequest("PLATFORM_MISMATCH", "That post is from another platform than this draft");
        }
        java.sql.Timestamp published = (java.sql.Timestamp) row.get("published_at");
        d.recordPublication(ContentDraft.PublicationSource.VERIFIED_API, published.toInstant(),
                (String) row.get("permalink"), req.socialPostId());
        return view(d);
    }

    public DraftView clearPublication(UUID id) {
        ContentDraft d = owned(id);
        d.clearPublication();
        return view(d);
    }

    public List<DraftView> repurpose(UUID id, RepurposeRequest req) {
        ContentDraft source = owned(id);
        List<ContentDraft> created = new ArrayList<>();
        for (RepurposeRequest.Variant v : req.variants()) {
            ContentDraft d = new ContentDraft(Ids.newId(), workspace.id());
            d.setParentDraftId(source.getId());
            d.setTitle(source.getTitle() + " — " + label(v.platform()) + " " + v.contentType().name().toLowerCase());
            if (d.getTitle().length() > 200) d.setTitle(d.getTitle().substring(0, 200));
            d.setPlatform(v.platform());
            d.setContentType(v.contentType());
            d.setCaption(source.getCaption());
            d.setScript(source.getScript());
            d.setHashtags(new ArrayList<>(source.getHashtags()));
            d.setNotes(source.getNotes());
            d.setGoalId(source.getGoalId());
            d.setCampaignId(source.getCampaignId());
            drafts.save(d);
            snapshot(d, "Repurposed from \"" + source.getTitle() + "\"");
            created.add(d);
        }
        return views(created);
    }

    @Transactional(readOnly = true)
    public List<VersionView> versions(UUID id) {
        owned(id);
        return versions.findByDraftIdOrderByVersionNumberDesc(id).stream().map(VersionView::of).toList();
    }

    public DraftView restore(UUID id, int versionNumber) {
        ContentDraft d = owned(id);
        ContentVersion v = versions.findByDraftIdAndVersionNumber(id, versionNumber)
                .orElseThrow(() -> BloomException.notFound("Version"));
        ContentVersion.Snapshot s = v.getSnapshot();
        d.setTitle(s.title());
        d.setCaption(s.caption());
        d.setScript(s.script());
        d.setHashtags(new ArrayList<>(s.hashtags() == null ? List.of() : s.hashtags()));
        d.setNotes(s.notes());
        snapshot(d, "Restored version " + versionNumber);
        return view(d);
    }

    public void delete(UUID id) {
        drafts.delete(owned(id));
    }

    // ---------------------------------------------------------------- helpers

    private void applyIdea(ContentIdea i, IdeaRequest req) {
        i.setTitle(req.title().trim());
        i.setNotes(blankToNull(req.notes()));
        i.setPlatform(req.platform());
        i.setTags(new ArrayList<>(req.tags() == null ? List.of() : req.tags().stream().map(String::trim).distinct().toList()));
    }

    private void applyDraft(ContentDraft d, DraftRequest req) {
        if (req.goalId() != null) requireInWorkspace("goal", req.goalId(), "Goal");
        if (req.campaignId() != null) requireInWorkspace("campaign", req.campaignId(), "Campaign");
        d.setTitle(req.title().trim());
        d.setPlatform(req.platform());
        d.setContentType(req.contentType());
        d.setCaption(blankToNull(req.caption()));
        d.setScript(blankToNull(req.script()));
        d.setHashtags(new ArrayList<>(normalizeHashtags(req.hashtags())));
        d.setNotes(blankToNull(req.notes()));
        d.setPlannedDate(req.plannedDate());
        d.setGoalId(req.goalId());
        d.setCampaignId(req.campaignId());
    }

    /** Hashtags are stored without the leading '#', de-duplicated case-insensitively. */
    static List<String> normalizeHashtags(List<String> raw) {
        if (raw == null) return List.of();
        LinkedHashMap<String, String> seen = new LinkedHashMap<>();
        for (String h : raw) {
            String t = h.trim().replaceFirst("^#+", "");
            if (!t.isEmpty()) seen.putIfAbsent(t.toLowerCase(Locale.ROOT), t);
        }
        return List.copyOf(seen.values());
    }

    private void snapshot(ContentDraft d, String summary) {
        int next = d.getCurrentVersion() + 1;
        versions.save(new ContentVersion(Ids.newId(), d.getId(), next, snapshotOf(d), summary, clock.instant()));
        d.setCurrentVersion(next);
    }

    private static ContentVersion.Snapshot snapshotOf(ContentDraft d) {
        return new ContentVersion.Snapshot(d.getTitle(), d.getCaption(), d.getScript(), List.copyOf(d.getHashtags()), d.getNotes());
    }

    private static String summary(DraftRequest req, String fallback) {
        return req.changeSummary() == null || req.changeSummary().isBlank() ? fallback : req.changeSummary().trim();
    }

    private DraftView view(ContentDraft d) {
        return views(List.of(d)).get(0);
    }

    private List<DraftView> views(List<ContentDraft> list) {
        if (list.isEmpty()) return List.of();
        Map<UUID, String> goalTitles = titles("goal", "title", list.stream().map(ContentDraft::getGoalId));
        Map<UUID, String> campaignNames = titles("campaign", "name", list.stream().map(ContentDraft::getCampaignId));
        Map<UUID, String> parentTitles = titles("content_draft", "title", list.stream().map(ContentDraft::getParentDraftId));
        Map<UUID, Long> variants = new HashMap<>();
        jdbc.query("SELECT parent_draft_id, count(*) FROM content_draft WHERE parent_draft_id IN (:ids) GROUP BY parent_draft_id",
                new MapSqlParameterSource("ids", list.stream().map(ContentDraft::getId).toList()),
                rs -> { variants.put(rs.getObject(1, UUID.class), rs.getLong(2)); });
        return list.stream().map(d -> new DraftView(d.getId(), d.getIdeaId(), d.getParentDraftId(),
                parentTitles.get(d.getParentDraftId()), d.getTitle(), d.getPlatform(), d.getContentType(), d.getCaption(),
                d.getScript(), List.copyOf(d.getHashtags()), d.getNotes(), d.getPlannedDate(), d.getStage(), d.getGoalId(),
                goalTitles.get(d.getGoalId()), d.getCampaignId(), campaignNames.get(d.getCampaignId()), d.getPublishedAt(),
                d.getPublishedUrl(), d.getPublicationSource(), d.getSocialPostId(), d.getCurrentVersion(),
                variants.getOrDefault(d.getId(), 0L).intValue(), d.getCreatedAt(), d.getUpdatedAt())).toList();
    }

    private Map<UUID, String> titles(String table, String column, java.util.stream.Stream<UUID> ids) {
        Set<UUID> set = ids.filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, String> out = new HashMap<>();
        if (set.isEmpty()) return out;
        jdbc.query("SELECT id, " + column + " FROM " + table + " WHERE id IN (:ids)", new MapSqlParameterSource("ids", set),
                rs -> { out.put(rs.getObject(1, UUID.class), rs.getString(2)); });
        return out;
    }

    private void requireInWorkspace(String table, UUID id, String label) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM " + table + " WHERE id = :id AND workspace_id = :ws",
                new MapSqlParameterSource("id", id).addValue("ws", workspace.id()), Integer.class);
        if (n == null || n == 0) throw BloomException.notFound(label);
    }

    private static String label(com.bloom.social.domain.Provider p) {
        return switch (p) {
            case INSTAGRAM -> "Instagram";
            case YOUTUBE -> "YouTube";
            case TIKTOK -> "TikTok";
        };
    }

    private ContentDraft owned(UUID id) {
        return drafts.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Draft"));
    }

    private ContentIdea ownedIdea(UUID id) {
        return ideas.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Idea"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
