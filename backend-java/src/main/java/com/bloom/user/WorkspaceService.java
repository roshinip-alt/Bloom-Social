package com.bloom.user;

import com.bloom.auth.CurrentWorkspace;
import com.bloom.config.BloomProperties;
import com.bloom.exception.BloomException;
import com.bloom.user.WorkspaceDtos.UpdateWorkspaceRequest;
import com.bloom.user.WorkspaceDtos.WorkspaceView;
import java.time.DateTimeException;
import java.time.ZoneId;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkspaceService {
    private final WorkspaceRepository workspaces;
    private final CurrentWorkspace current;
    private final DemoWorkspaceSeeder seeder;
    private final BloomProperties props;

    public WorkspaceService(WorkspaceRepository workspaces, CurrentWorkspace current, DemoWorkspaceSeeder seeder,
                            BloomProperties props) {
        this.workspaces = workspaces;
        this.current = current;
        this.seeder = seeder;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public List<WorkspaceView> list() {
        return workspaces.findAllByOrderByDemoDescCreatedAtAsc().stream().map(WorkspaceView::of).toList();
    }

    @Transactional(readOnly = true)
    public WorkspaceView current() {
        return WorkspaceView.of(current.workspace());
    }

    @Transactional
    public WorkspaceView update(UpdateWorkspaceRequest req) {
        try {
            ZoneId.of(req.timezone());
        } catch (DateTimeException e) {
            throw BloomException.badRequest("INVALID_TIMEZONE", "Unknown timezone '" + req.timezone() + "'");
        }
        Workspace w = workspaces.findById(current.id()).orElseThrow(() -> BloomException.notFound("Workspace"));
        w.setName(req.name().trim());
        w.setTimezone(req.timezone());
        w.setDefaultCurrency(req.defaultCurrency());
        return WorkspaceView.of(w);
    }

    /**
     * Deletes and rebuilds the synthetic demo workspace. Only the demo workspace can be reset, so live
     * connections (which live in the personal workspace) are never touched.
     */
    public WorkspaceView resetDemo() {
        if (!props.workspace().demoResetEnabled()) {
            throw BloomException.conflict("DEMO_RESET_DISABLED", "Demo reset is disabled in this environment");
        }
        if (!current.isDemo()) {
            throw BloomException.conflict("NOT_DEMO_WORKSPACE", "Only the demo workspace can be reset");
        }
        return WorkspaceView.of(seeder.resetDemoWorkspace());
    }
}
