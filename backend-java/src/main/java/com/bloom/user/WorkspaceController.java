package com.bloom.user;

import com.bloom.user.WorkspaceDtos.UpdateWorkspaceRequest;
import com.bloom.user.WorkspaceDtos.WorkspaceView;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceController {
    private final WorkspaceService service;

    public WorkspaceController(WorkspaceService service) {
        this.service = service;
    }

    @GetMapping
    public List<WorkspaceView> list() {
        return service.list();
    }

    @GetMapping("/current")
    public WorkspaceView current() {
        return service.current();
    }

    @PutMapping("/current")
    public WorkspaceView update(@Valid @RequestBody UpdateWorkspaceRequest body) {
        return service.update(body);
    }

    /** Rebuilds the synthetic demo workspace (demo workspace only). */
    @PostMapping("/current/demo-reset")
    public WorkspaceView resetDemo() {
        return service.resetDemo();
    }
}
