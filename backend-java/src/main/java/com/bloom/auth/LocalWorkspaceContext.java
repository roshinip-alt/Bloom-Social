package com.bloom.auth;

import com.bloom.exception.BloomException;
import com.bloom.user.Workspace;
import com.bloom.user.WorkspaceRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Local development context — NOT authentication. The UI sends {@code X-Bloom-Workspace-Id} to choose between the
 * synthetic demo workspace and the personal workspace that holds live connections; without the header the demo
 * workspace is used. Unknown ids are rejected rather than silently falling back.
 */
@Component
public class LocalWorkspaceContext implements CurrentWorkspace {
    public static final String HEADER = "X-Bloom-Workspace-Id";

    private final WorkspaceRepository repository;

    public LocalWorkspaceContext(WorkspaceRepository repository) {
        this.repository = repository;
    }

    @Override
    public Workspace workspace() {
        String requested = requestedId();
        if (requested != null) {
            UUID id = parse(requested);
            return repository.findById(id).orElseThrow(() -> BloomException.notFound("Workspace"));
        }
        return repository.findFirstByOrderByDemoDescCreatedAtAsc().orElseThrow(() -> new BloomException(
                HttpStatus.SERVICE_UNAVAILABLE, "WORKSPACE_MISSING",
                "No workspace exists yet. Restart the backend so it can create the local workspaces."));
    }

    private static String requestedId() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) {
            HttpServletRequest request = attrs.getRequest();
            String value = request.getHeader(HEADER);
            return value == null || value.isBlank() ? null : value.trim();
        }
        return null;
    }

    private static UUID parse(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw BloomException.badRequest("INVALID_WORKSPACE_ID", "The workspace id header is not a valid id");
        }
    }
}
