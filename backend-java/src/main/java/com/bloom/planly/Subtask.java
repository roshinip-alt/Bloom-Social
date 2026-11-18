package com.bloom.planly;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "subtask")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Subtask {
    @Id
    private UUID id;
    @Column(name = "task_id")
    private UUID taskId;
    private String title;
    private boolean done;
    private int position;
    @Column(name = "created_at")
    private Instant createdAt;

    public Subtask(UUID id, UUID taskId, String title, int position, Instant now) {
        this.id = id;
        this.taskId = taskId;
        this.title = title;
        this.position = position;
        this.createdAt = now;
    }
}
