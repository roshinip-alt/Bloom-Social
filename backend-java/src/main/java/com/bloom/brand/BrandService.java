package com.bloom.brand;

import com.bloom.auth.CurrentWorkspace;
import com.bloom.brand.BrandDtos.*;
import com.bloom.common.persistence.Ids;
import com.bloom.exception.BloomException;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Brand CRM, campaign pipeline, deliverables and manual payment tracking. */
@Service
@Transactional
public class BrandService {
    private final BrandContactRepository brands;
    private final CampaignRepository campaigns;
    private final DeliverableRepository deliverables;
    private final PaymentRecordRepository payments;
    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentWorkspace workspace;
    private final Clock clock;

    public BrandService(BrandContactRepository brands, CampaignRepository campaigns, DeliverableRepository deliverables,
                        PaymentRecordRepository payments, NamedParameterJdbcTemplate jdbc, CurrentWorkspace workspace,
                        Clock clock) {
        this.brands = brands;
        this.campaigns = campaigns;
        this.deliverables = deliverables;
        this.payments = payments;
        this.jdbc = jdbc;
        this.workspace = workspace;
        this.clock = clock;
    }

    LocalDate today() {
        return LocalDate.now(clock.withZone(workspace.zone()));
    }

    // ---------------------------------------------------------------- brands

    @Transactional(readOnly = true)
    public List<BrandView> brands(String query) {
        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return brands.findByWorkspaceIdOrderByBrandNameAsc(workspace.id()).stream()
                .filter(b -> q.isEmpty() || contains(b.getBrandName(), q) || contains(b.getContactName(), q) || contains(b.getEmail(), q))
                .map(this::brandView).toList();
    }

    public BrandView createBrand(BrandRequest req) {
        BrandContact b = new BrandContact(Ids.newId(), workspace.id());
        applyBrand(b, req);
        return brandView(brands.save(b));
    }

    public BrandView updateBrand(UUID id, BrandRequest req) {
        BrandContact b = ownedBrand(id);
        applyBrand(b, req);
        return brandView(b);
    }

    public void deleteBrand(UUID id) {
        BrandContact b = ownedBrand(id);
        if (campaigns.countByBrandContactId(id) > 0) {
            throw BloomException.conflict("BRAND_HAS_CAMPAIGNS", "Archive or delete this brand's campaigns first");
        }
        brands.delete(b);
    }

    // ---------------------------------------------------------------- campaigns

    @Transactional(readOnly = true)
    public List<CampaignView> campaigns(Campaign.Stage stage, UUID brandId) {
        List<Campaign> list = campaigns.findByWorkspaceIdOrderByUpdatedAtDesc(workspace.id()).stream()
                .filter(c -> stage == null || c.getStage() == stage)
                .filter(c -> brandId == null || c.getBrandContactId().equals(brandId)).toList();
        return campaignViews(list);
    }

    @Transactional(readOnly = true)
    public CampaignView campaign(UUID id) {
        return campaignViews(List.of(ownedCampaign(id))).get(0);
    }

    public CampaignView createCampaign(CampaignRequest req) {
        Campaign c = new Campaign(Ids.newId(), workspace.id());
        applyCampaign(c, req);
        campaigns.save(c);
        return campaign(c.getId());
    }

    public CampaignView updateCampaign(UUID id, CampaignRequest req) {
        Campaign c = ownedCampaign(id);
        String before = c.getCurrency();
        applyCampaign(c, req);
        if (!c.getCurrency().equals(before) && !payments.findByCampaignIdInOrderByDueDateAscCreatedAtAsc(List.of(id)).isEmpty()) {
            throw BloomException.conflict("CURRENCY_LOCKED", "The currency cannot change once payments are recorded");
        }
        return campaign(id);
    }

    public CampaignView moveStage(UUID id, Campaign.Stage stage) {
        ownedCampaign(id).setStage(stage);
        return campaign(id);
    }

    public void deleteCampaign(UUID id) {
        campaigns.delete(ownedCampaign(id));
    }

    // ---------------------------------------------------------------- deliverables

    public DeliverableView addDeliverable(UUID campaignId, DeliverableRequest req) {
        ownedCampaign(campaignId);
        Deliverable d = new Deliverable(Ids.newId(), campaignId);
        applyDeliverable(d, req);
        return deliverableView(deliverables.save(d), today());
    }

    public DeliverableView updateDeliverable(UUID campaignId, UUID id, DeliverableRequest req) {
        Deliverable d = ownedDeliverable(campaignId, id);
        applyDeliverable(d, req);
        return deliverableView(d, today());
    }

    public void deleteDeliverable(UUID campaignId, UUID id) {
        deliverables.delete(ownedDeliverable(campaignId, id));
    }

    // ---------------------------------------------------------------- payments

    public PaymentView addPayment(UUID campaignId, PaymentRequest req) {
        Campaign c = ownedCampaign(campaignId);
        PaymentRecord p = new PaymentRecord(Ids.newId(), campaignId);
        applyPayment(p, c, req);
        return paymentView(payments.save(p), today());
    }

    public PaymentView updatePayment(UUID campaignId, UUID id, PaymentRequest req) {
        Campaign c = ownedCampaign(campaignId);
        PaymentRecord p = ownedPayment(campaignId, id);
        applyPayment(p, c, req);
        return paymentView(p, today());
    }

    public void deletePayment(UUID campaignId, UUID id) {
        payments.delete(ownedPayment(campaignId, id));
    }

    // ---------------------------------------------------------------- earnings

    @Transactional(readOnly = true)
    public EarningsSummary earnings(int year) {
        LocalDate today = today();
        List<Campaign> all = campaigns.findByWorkspaceIdOrderByUpdatedAtDesc(workspace.id());
        Map<UUID, Campaign> byId = all.stream().collect(Collectors.toMap(Campaign::getId, c -> c));
        List<PaymentRecord> pays = all.isEmpty() ? List.of()
                : payments.findByCampaignIdInOrderByDueDateAscCreatedAtAsc(byId.keySet());

        Set<String> currencies = new TreeSet<>();
        all.forEach(c -> currencies.add(c.getCurrency()));
        pays.forEach(p -> currencies.add(p.getCurrency()));

        List<CurrencySummary> out = new ArrayList<>();
        for (String cur : currencies) {
            List<PaymentRecord> mine = pays.stream().filter(p -> p.getCurrency().equals(cur)).toList();
            BigDecimal[] monthly = new BigDecimal[12];
            Arrays.fill(monthly, BigDecimal.ZERO);
            mine.stream().filter(p -> p.isPaid() && p.getPaidDate().getYear() == year)
                    .forEach(p -> monthly[p.getPaidDate().getMonthValue() - 1] = monthly[p.getPaidDate().getMonthValue() - 1].add(p.getAmount()));
            BigDecimal paidInYear = Arrays.stream(monthly).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal unpaid = sum(mine.stream().filter(p -> !p.isPaid()), PaymentRecord::getAmount);
            BigDecimal overdue = sum(mine.stream().filter(p -> !p.isPaid() && p.getDueDate() != null && p.getDueDate().isBefore(today)),
                    PaymentRecord::getAmount);
            BigDecimal committed = BigDecimal.ZERO;
            for (Campaign c : all) {
                if (c.getCurrency().equals(cur) && c.getStage().isCommitted() && c.getAgreedAmount() != null) {
                    BigDecimal paid = sum(mine.stream().filter(p -> p.getCampaignId().equals(c.getId()) && p.isPaid()), PaymentRecord::getAmount);
                    committed = committed.add(c.getAgreedAmount().subtract(paid).max(BigDecimal.ZERO));
                }
            }
            BigDecimal pipeline = sum(all.stream().filter(c -> c.getCurrency().equals(cur) && c.getStage().isPipeline()
                    && c.getAgreedAmount() != null), Campaign::getAgreedAmount);
            List<MonthAmount> months = new ArrayList<>();
            for (int m = 0; m < 12; m++) months.add(new MonthAmount(m + 1, monthly[m]));
            out.add(new CurrencySummary(cur, paidInYear, unpaid, overdue, committed, pipeline, months));
        }
        long active = all.stream().filter(c -> c.getStage().isCommitted()).count();
        long overdueCount = pays.stream().filter(p -> !p.isPaid() && p.getDueDate() != null && p.getDueDate().isBefore(today)).count();
        return new EarningsSummary(year, today, out, active, overdueCount);
    }

    // ---------------------------------------------------------------- helpers

    private void applyBrand(BrandContact b, BrandRequest req) {
        b.setBrandName(req.brandName().trim());
        b.setContactName(blankToNull(req.contactName()));
        b.setEmail(blankToNull(req.email()));
        b.setPhone(blankToNull(req.phone()));
        b.setWebsite(blankToNull(req.website()));
        b.setNotes(blankToNull(req.notes()));
    }

    private void applyCampaign(Campaign c, CampaignRequest req) {
        ownedBrand(req.brandContactId());
        if (req.startDate() != null && req.endDate() != null && req.endDate().isBefore(req.startDate())) {
            throw BloomException.badRequest("INVALID_DATES", "The end date must be on or after the start date");
        }
        c.setBrandContactId(req.brandContactId());
        c.setName(req.name().trim());
        if (req.stage() != null) c.setStage(req.stage());
        c.setAgreedAmount(req.agreedAmount());
        c.setCurrency(req.currency());
        c.setStartDate(req.startDate());
        c.setEndDate(req.endDate());
        c.setNotes(blankToNull(req.notes()));
    }

    private void applyDeliverable(Deliverable d, DeliverableRequest req) {
        if (req.contentDraftId() != null) {
            Integer n = jdbc.queryForObject("SELECT count(*) FROM content_draft WHERE id = :id AND workspace_id = :ws",
                    new MapSqlParameterSource("id", req.contentDraftId()).addValue("ws", workspace.id()), Integer.class);
            if (n == null || n == 0) throw BloomException.notFound("Content draft");
        }
        d.setTitle(req.title().trim());
        d.setPlatform(req.platform());
        d.setDueDate(req.dueDate());
        if (req.status() != null) d.setStatus(req.status());
        d.setContentDraftId(req.contentDraftId());
        d.setNotes(blankToNull(req.notes()));
    }

    private void applyPayment(PaymentRecord p, Campaign c, PaymentRequest req) {
        String currency = req.currency() == null ? c.getCurrency() : req.currency();
        if (!currency.equals(c.getCurrency())) {
            throw BloomException.badRequest("CURRENCY_MISMATCH",
                    "Payments must use the campaign currency (" + c.getCurrency() + ")");
        }
        if (req.paidDate() != null && req.paidDate().isAfter(today())) {
            throw BloomException.badRequest("PAID_IN_FUTURE", "The paid date cannot be in the future");
        }
        p.setAmount(req.amount());
        p.setCurrency(currency);
        p.setInvoiceReference(blankToNull(req.invoiceReference()));
        p.setInvoicedDate(req.invoicedDate());
        p.setDueDate(req.dueDate());
        p.setPaidDate(req.paidDate());
        p.setNote(blankToNull(req.note()));
    }

    private BrandView brandView(BrandContact b) {
        return new BrandView(b.getId(), b.getBrandName(), b.getContactName(), b.getEmail(), b.getPhone(), b.getWebsite(),
                b.getNotes(), campaigns.countByBrandContactId(b.getId()), b.getCreatedAt(), b.getUpdatedAt());
    }

    private List<CampaignView> campaignViews(List<Campaign> list) {
        if (list.isEmpty()) return List.of();
        LocalDate today = today();
        List<UUID> ids = list.stream().map(Campaign::getId).toList();
        Map<UUID, List<Deliverable>> dels = deliverables.findByCampaignIdInOrderByDueDateAscCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(Deliverable::getCampaignId));
        Map<UUID, List<PaymentRecord>> pays = payments.findByCampaignIdInOrderByDueDateAscCreatedAtAsc(ids).stream()
                .collect(Collectors.groupingBy(PaymentRecord::getCampaignId));
        Map<UUID, String> brandNames = brands.findAllById(list.stream().map(Campaign::getBrandContactId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(BrandContact::getId, BrandContact::getBrandName));
        return list.stream().map(c -> {
            List<Deliverable> ds = dels.getOrDefault(c.getId(), List.of());
            List<PaymentRecord> ps = pays.getOrDefault(c.getId(), List.of());
            BigDecimal paid = sum(ps.stream().filter(PaymentRecord::isPaid), PaymentRecord::getAmount);
            BigDecimal outstanding = c.getAgreedAmount() == null ? null : c.getAgreedAmount().subtract(paid).max(BigDecimal.ZERO);
            LocalDate next = Stream.concat(
                            ds.stream().filter(d -> d.getStatus() != Deliverable.Status.PUBLISHED && d.getStatus() != Deliverable.Status.APPROVED)
                                    .map(Deliverable::getDueDate),
                            ps.stream().filter(Predicate.not(PaymentRecord::isPaid)).map(PaymentRecord::getDueDate))
                    .filter(Objects::nonNull).min(Comparator.naturalOrder()).orElse(null);
            return new CampaignView(c.getId(), c.getBrandContactId(), brandNames.get(c.getBrandContactId()), c.getName(),
                    c.getStage(), c.getAgreedAmount(), c.getCurrency(), paid, outstanding, c.getStartDate(), c.getEndDate(),
                    next, c.getNotes(), ds.stream().map(d -> deliverableView(d, today)).toList(),
                    ps.stream().map(p -> paymentView(p, today)).toList(), c.getCreatedAt(), c.getUpdatedAt());
        }).toList();
    }

    private static DeliverableView deliverableView(Deliverable d, LocalDate today) {
        boolean done = d.getStatus() == Deliverable.Status.APPROVED || d.getStatus() == Deliverable.Status.PUBLISHED;
        return new DeliverableView(d.getId(), d.getCampaignId(), d.getTitle(), d.getPlatform(), d.getDueDate(), d.getStatus(),
                d.getContentDraftId(), d.getNotes(), !done && d.getDueDate() != null && d.getDueDate().isBefore(today));
    }

    private static PaymentView paymentView(PaymentRecord p, LocalDate today) {
        return new PaymentView(p.getId(), p.getCampaignId(), p.getAmount(), p.getCurrency(), p.getInvoiceReference(),
                p.getInvoicedDate(), p.getDueDate(), p.getPaidDate(), p.getNote(), p.isPaid(),
                !p.isPaid() && p.getDueDate() != null && p.getDueDate().isBefore(today));
    }

    private static <T> BigDecimal sum(Stream<T> items, java.util.function.Function<T, BigDecimal> amount) {
        return items.map(amount).filter(Objects::nonNull).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BrandContact ownedBrand(UUID id) {
        return brands.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Brand"));
    }

    private Campaign ownedCampaign(UUID id) {
        return campaigns.findByIdAndWorkspaceId(id, workspace.id()).orElseThrow(() -> BloomException.notFound("Campaign"));
    }

    private Deliverable ownedDeliverable(UUID campaignId, UUID id) {
        ownedCampaign(campaignId);
        return deliverables.findById(id).filter(d -> d.getCampaignId().equals(campaignId))
                .orElseThrow(() -> BloomException.notFound("Deliverable"));
    }

    private PaymentRecord ownedPayment(UUID campaignId, UUID id) {
        return payments.findById(id).filter(p -> p.getCampaignId().equals(campaignId))
                .orElseThrow(() -> BloomException.notFound("Payment"));
    }

    private static boolean contains(String value, String q) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(q);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
