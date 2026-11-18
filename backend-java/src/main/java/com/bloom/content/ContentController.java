package com.bloom.content;

import com.bloom.content.ContentDtos.*;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/content")
public class ContentController {
    private final ContentService service;

    public ContentController(ContentService service) {
        this.service = service;
    }

    @GetMapping("/pipeline")
    public PipelineView pipeline() {
        return service.pipeline();
    }

    // ---- ideas
    @GetMapping("/ideas")
    public List<IdeaView> ideas(@RequestParam(defaultValue = "false") boolean includeArchived) {
        return service.ideas(includeArchived);
    }

    @PostMapping("/ideas")
    @ResponseStatus(HttpStatus.CREATED)
    public IdeaView createIdea(@Valid @RequestBody IdeaRequest body) {
        return service.createIdea(body);
    }

    @PutMapping("/ideas/{id}")
    public IdeaView updateIdea(@PathVariable UUID id, @Valid @RequestBody IdeaRequest body) {
        return service.updateIdea(id, body);
    }

    @PostMapping("/ideas/{id}/archive")
    public IdeaView archiveIdea(@PathVariable UUID id) {
        return service.setIdeaArchived(id, true);
    }

    @PostMapping("/ideas/{id}/restore")
    public IdeaView restoreIdea(@PathVariable UUID id) {
        return service.setIdeaArchived(id, false);
    }

    @DeleteMapping("/ideas/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteIdea(@PathVariable UUID id) {
        service.deleteIdea(id);
    }

    @PostMapping("/ideas/{id}/promote")
    @ResponseStatus(HttpStatus.CREATED)
    public DraftView promote(@PathVariable UUID id, @Valid @RequestBody PromoteRequest body) {
        return service.promote(id, body);
    }

    // ---- drafts
    @GetMapping("/drafts/{id}")
    public DraftView get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/drafts")
    @ResponseStatus(HttpStatus.CREATED)
    public DraftView create(@Valid @RequestBody DraftRequest body) {
        return service.create(body);
    }

    @PutMapping("/drafts/{id}")
    public DraftView update(@PathVariable UUID id, @Valid @RequestBody DraftRequest body) {
        return service.update(id, body);
    }

    @PatchMapping("/drafts/{id}/stage")
    public DraftView stage(@PathVariable UUID id, @Valid @RequestBody StageRequest body) {
        return service.moveStage(id, body.stage());
    }

    @PostMapping("/drafts/{id}/publication")
    public DraftView recordPublication(@PathVariable UUID id, @Valid @RequestBody PublicationRequest body) {
        return service.recordPublication(id, body);
    }

    @PostMapping("/drafts/{id}/publication/link-post")
    public DraftView linkPost(@PathVariable UUID id, @Valid @RequestBody LinkPostRequest body) {
        return service.linkPost(id, body);
    }

    @DeleteMapping("/drafts/{id}/publication")
    public DraftView clearPublication(@PathVariable UUID id) {
        return service.clearPublication(id);
    }

    @PostMapping("/drafts/{id}/repurpose")
    @ResponseStatus(HttpStatus.CREATED)
    public List<DraftView> repurpose(@PathVariable UUID id, @Valid @RequestBody RepurposeRequest body) {
        return service.repurpose(id, body);
    }

    @GetMapping("/drafts/{id}/versions")
    public List<VersionView> versions(@PathVariable UUID id) {
        return service.versions(id);
    }

    @PostMapping("/drafts/{id}/versions/{version}/restore")
    public DraftView restore(@PathVariable UUID id, @PathVariable int version) {
        return service.restore(id, version);
    }

    @DeleteMapping("/drafts/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
