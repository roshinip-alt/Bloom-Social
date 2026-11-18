package com.bloom.brand;

import com.bloom.common.persistence.Timestamped;
import com.bloom.social.domain.Provider;
import jakarta.persistence.*;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "deliverable")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Deliverable extends Timestamped {
    public enum Status { PLANNED, IN_PROGRESS, SUBMITTED, APPROVED, PUBLISHED }

    @Id
    private UUID id;
    @Column(name = "campaign_id")
    private UUID campaignId;
    private String title;
    @Enumerated(EnumType.STRING)
    private Provider platform;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Enumerated(EnumType.STRING)
    private Status status;
    @Column(name = "content_draft_id")
    private UUID contentDraftId;
    private String notes;

    public Deliverable(UUID id, UUID campaignId) {
        this.id = id;
        this.campaignId = campaignId;
        this.status = Status.PLANNED;
    }
}
