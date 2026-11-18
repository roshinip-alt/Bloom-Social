package com.bloom.brand;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface BrandContactRepository extends JpaRepository<BrandContact, UUID> {
    List<BrandContact> findByWorkspaceIdOrderByBrandNameAsc(UUID workspaceId);

    Optional<BrandContact> findByIdAndWorkspaceId(UUID id, UUID workspaceId);
}

interface CampaignRepository extends JpaRepository<Campaign, UUID> {
    List<Campaign> findByWorkspaceIdOrderByUpdatedAtDesc(UUID workspaceId);

    Optional<Campaign> findByIdAndWorkspaceId(UUID id, UUID workspaceId);

    long countByBrandContactId(UUID brandContactId);
}

interface DeliverableRepository extends JpaRepository<Deliverable, UUID> {
    List<Deliverable> findByCampaignIdInOrderByDueDateAscCreatedAtAsc(Collection<UUID> campaignIds);
}

interface PaymentRecordRepository extends JpaRepository<PaymentRecord, UUID> {
    List<PaymentRecord> findByCampaignIdInOrderByDueDateAscCreatedAtAsc(Collection<UUID> campaignIds);
}
