package com.bloom.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

public final class WorkspaceDtos {
    private WorkspaceDtos() {}

    public record WorkspaceView(UUID id, String name, String timezone, String defaultCurrency, boolean demo) {
        static WorkspaceView of(Workspace w) {
            return new WorkspaceView(w.getId(), w.getName(), w.getTimezone(), w.getDefaultCurrency(), w.isDemo());
        }
    }

    public record UpdateWorkspaceRequest(
            @NotBlank @Size(max = 120) String name,
            @NotBlank @Size(max = 64) String timezone,
            @NotBlank @Pattern(regexp = "[A-Z]{3}", message = "must be a 3-letter ISO 4217 code") String defaultCurrency) {}
}
