package com.bloom.user;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceRepository extends JpaRepository<Workspace, UUID> {
    /** The default workspace: the demo workspace if one exists, otherwise the oldest. */
    Optional<Workspace> findFirstByOrderByDemoDescCreatedAtAsc();

    List<Workspace> findAllByOrderByDemoDescCreatedAtAsc();

    Optional<Workspace> findFirstByDemoTrue();

    boolean existsByDemoFalse();
}
