package com.bloom.brand;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.*;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A brand and its primary contact (lightweight CRM record). */
@Entity
@Table(name = "brand_contact")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BrandContact extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Column(name = "brand_name")
    private String brandName;
    @Column(name = "contact_name")
    private String contactName;
    private String email;
    private String phone;
    private String website;
    private String notes;

    public BrandContact(UUID id, UUID workspaceId) {
        this.id = id;
        this.workspaceId = workspaceId;
    }
}
