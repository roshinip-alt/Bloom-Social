package com.bloom.brand;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A collaboration with a brand. Money is tracked manually; Bloom processes no payments. */
@Entity
@Table(name = "campaign")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Campaign extends Timestamped {
    public enum Stage {
        LEAD, CONTACTED, NEGOTIATING, CONFIRMED, IN_PROGRESS, DELIVERED, PAID, ARCHIVED;

        /** Stages where the agreed amount is committed and still expected to be paid. */
        public boolean isCommitted() {
            return this == CONFIRMED || this == IN_PROGRESS || this == DELIVERED;
        }

        public boolean isPipeline() {
            return this == LEAD || this == CONTACTED || this == NEGOTIATING;
        }
    }

    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Column(name = "brand_contact_id")
    private UUID brandContactId;
    private String name;
    @Enumerated(EnumType.STRING)
    private Stage stage;
    @Column(name = "agreed_amount")
    private BigDecimal agreedAmount;
    private String currency;
    @Column(name = "start_date")
    private LocalDate startDate;
    @Column(name = "end_date")
    private LocalDate endDate;
    private String notes;

    public Campaign(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.stage = Stage.LEAD;
    }
}
