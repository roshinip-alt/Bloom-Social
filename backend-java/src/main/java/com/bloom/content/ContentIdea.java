package com.bloom.content;

import com.bloom.common.persistence.Timestamped;
import com.bloom.social.domain.Provider;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** An entry in the idea bank — the "Ideas" column of the pipeline. Promoting it creates a draft. */
@Entity
@Table(name = "content_idea")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ContentIdea extends Timestamped {
    public enum Status { OPEN, PROMOTED, ARCHIVED }

    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    private String title;
    private String notes;
    @Enumerated(EnumType.STRING)
    private Provider platform;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tags", columnDefinition = "text[]")
    private List<String> tags = new ArrayList<>();
    @Enumerated(EnumType.STRING)
    private Status status;

    public ContentIdea(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.status = Status.OPEN;
    }
}
