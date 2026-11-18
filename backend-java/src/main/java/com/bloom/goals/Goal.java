package com.bloom.goals;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "goal")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Goal extends Timestamped {
    public enum Category { AUDIENCE, CONTENT, REVENUE, ENGAGEMENT, SKILL, PERSONAL }
    public enum ProgressSource { MANUAL, ANALYTICS }
    public enum Status { ACTIVE, COMPLETED, ARCHIVED }

    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    private String title;
    @Enumerated(EnumType.STRING)
    private Category category;
    private String description;
    private String unit;
    @Column(name = "start_value")
    private BigDecimal startValue;
    @Column(name = "target_value")
    private BigDecimal targetValue;
    @Column(name = "current_value")
    private BigDecimal currentValue;
    @Column(name = "start_date")
    private LocalDate startDate;
    private LocalDate deadline;
    @Enumerated(EnumType.STRING)
    @Column(name = "progress_source")
    private ProgressSource progressSource;
    @Column(name = "linked_account_id")
    private UUID linkedAccountId;
    @Column(name = "linked_metric_key")
    private String linkedMetricKey;
    @Enumerated(EnumType.STRING)
    private Status status;
    @Column(name = "completed_at")
    private Instant completedAt;

    public Goal(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.status = Status.ACTIVE;
        this.startValue = BigDecimal.ZERO;
        this.currentValue = BigDecimal.ZERO;
        this.progressSource = ProgressSource.MANUAL;
    }

    public boolean targetReached() {
        boolean increasing = targetValue.compareTo(startValue) >= 0;
        return increasing ? currentValue.compareTo(targetValue) >= 0 : currentValue.compareTo(targetValue) <= 0;
    }
}
