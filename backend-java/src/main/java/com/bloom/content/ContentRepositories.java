package com.bloom.content;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ContentIdeaRepository extends JpaRepository<ContentIdea, UUID> {
    List<ContentIdea> findByWorkspaceIdAndStatusInOrderByCreatedAtDesc(UUID workspaceId, Collection<ContentIdea.Status> statuses);

    Optional<ContentIdea> findByIdAndWorkspaceId(UUID id, UUID workspaceId);
}

interface ContentDraftRepository extends JpaRepository<ContentDraft, UUID> {
    List<ContentDraft> findByWorkspaceIdOrderByPlannedDateAscCreatedAtAsc(UUID workspaceId);

    Optional<ContentDraft> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    List<ContentDraft> findByParentDraftId(UUID parentDraftId);
}

interface ContentVersionRepository extends JpaRepository<ContentVersion, UUID> {
    List<ContentVersion> findByDraftIdOrderByVersionNumberDesc(UUID draftId);

    Optional<ContentVersion> findByDraftIdAndVersionNumber(UUID draftId, int versionNumber);
}
