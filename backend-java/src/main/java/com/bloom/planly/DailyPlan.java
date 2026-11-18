package com.bloom.planly;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** The day's focus — one per workspace and date. */
@Entity
@Table(name = "daily_plan")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DailyPlan extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Column(name = "plan_date")
    private LocalDate planDate;
    private String focus;

    public DailyPlan(UUID id, UUID workspaceId, LocalDate planDate) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.planDate = planDate;
    }
}
