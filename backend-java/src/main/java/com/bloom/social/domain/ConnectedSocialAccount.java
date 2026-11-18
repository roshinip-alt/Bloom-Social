package com.bloom.social.domain;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "connected_social_account")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConnectedSocialAccount extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "workspace_id")
    private UUID workspaceId;
    @Enumerated(EnumType.STRING)
    private Provider provider;
    @Column(name = "provider_account_id")
    private String providerAccountId;
    private String handle;
    @Column(name = "display_name")
    private String displayName;
    @Column(name = "avatar_url")
    private String avatarUrl;
    @Column(name = "account_type")
    private String accountType;
    @Enumerated(EnumType.STRING)
    @Column(name = "data_mode")
    private DataMode dataMode;
    @Enumerated(EnumType.STRING)
    @Column(name = "connection_status")
    private ConnectionStatus connectionStatus;
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "granted_scopes", columnDefinition = "text[]")
    private List<String> grantedScopes = new ArrayList<>();
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "capabilities", columnDefinition = "text[]")
    private List<String> capabilities = new ArrayList<>();
    @Column(name = "last_sync_at")
    private Instant lastSyncAt;
    @Column(name = "last_successful_sync_at")
    private Instant lastSuccessfulSyncAt;
    @Column(name = "last_sync_error")
    private String lastSyncError;
    @Column(name = "connected_at")
    private Instant connectedAt;
    @Column(name = "disconnected_at")
    private Instant disconnectedAt;

    public ConnectedSocialAccount(UUID id, UUID workspaceId, Provider provider, String providerAccountId, DataMode mode) {
        this.id = id;
        this.workspaceId = workspaceId;
        this.provider = provider;
        this.providerAccountId = providerAccountId;
        this.dataMode = mode;
        this.connectionStatus = ConnectionStatus.ACTIVE;
        this.connectedAt = Instant.now();
    }

    public Set<Capability> capabilitySet() {
        Set<Capability> set = EnumSet.noneOf(Capability.class);
        capabilities.forEach(c -> set.add(Capability.valueOf(c)));
        return set;
    }

    public void setCapabilitySet(Set<Capability> caps) {
        this.capabilities = new ArrayList<>(caps.stream().map(Enum::name).sorted().toList());
    }

    public boolean has(Capability c) {
        return capabilities.contains(c.name());
    }

    public boolean isDemo() {
        return dataMode == DataMode.DEMO;
    }

    public boolean isSyncable() {
        return connectionStatus == ConnectionStatus.ACTIVE || connectionStatus == ConnectionStatus.ERROR;
    }
}
