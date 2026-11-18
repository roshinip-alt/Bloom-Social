package com.bloom.brand;

import com.bloom.social.domain.Provider;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class BrandDtos {
    private BrandDtos() {}

    public record BrandRequest(@NotBlank @Size(max = 160) String brandName, @Size(max = 160) String contactName,
                               @Email @Size(max = 254) String email, @Size(max = 48) String phone,
                               @Size(max = 512) String website, @Size(max = 10_000) String notes) {}

    public record BrandView(UUID id, String brandName, String contactName, String email, String phone, String website,
                            String notes, long campaignCount, Instant createdAt, Instant updatedAt) {}

    public record CampaignRequest(@NotNull UUID brandContactId, @NotBlank @Size(max = 200) String name,
                                  Campaign.Stage stage, @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal agreedAmount,
                                  @NotBlank @Pattern(regexp = "[A-Z]{3}", message = "must be a 3-letter ISO 4217 code") String currency,
                                  LocalDate startDate, LocalDate endDate, @Size(max = 10_000) String notes) {}

    public record StageRequest(@NotNull Campaign.Stage stage) {}

    public record DeliverableRequest(@NotBlank @Size(max = 200) String title, Provider platform, LocalDate dueDate,
                                     Deliverable.Status status, UUID contentDraftId, @Size(max = 5000) String notes) {}

    public record DeliverableView(UUID id, UUID campaignId, String title, Provider platform, LocalDate dueDate,
                                  Deliverable.Status status, UUID contentDraftId, String notes, boolean overdue) {}

    /** Currency defaults to the campaign's; mixing currencies inside one campaign is rejected. */
    public record PaymentRequest(@NotNull @PositiveOrZero @Digits(integer = 12, fraction = 2) BigDecimal amount,
                                 @Pattern(regexp = "[A-Z]{3}") String currency, @Size(max = 96) String invoiceReference,
                                 LocalDate invoicedDate, LocalDate dueDate, LocalDate paidDate,
                                 @Size(max = 500) String note) {}

    public record PaymentView(UUID id, UUID campaignId, BigDecimal amount, String currency, String invoiceReference,
                              LocalDate invoicedDate, LocalDate dueDate, LocalDate paidDate, String note,
                              boolean paid, boolean overdue) {}

    /** Paid and outstanding are per campaign currency — never converted. */
    public record CampaignView(UUID id, UUID brandContactId, String brandName, String name, Campaign.Stage stage,
                               BigDecimal agreedAmount, String currency, BigDecimal paidAmount,
                               BigDecimal outstandingAmount, LocalDate startDate, LocalDate endDate,
                               LocalDate nextDeadline, String notes, List<DeliverableView> deliverables,
                               List<PaymentView> payments, Instant createdAt, Instant updatedAt) {}

    public record MonthAmount(int month, BigDecimal paid) {}

    /**
     * Earnings for one currency. Amounts in different currencies are never added together.
     *
     * @param committedUnpaid agreed minus paid for Confirmed/In progress/Delivered campaigns
     * @param pipelineValue   agreed amounts quoted for Lead/Contacted/Negotiating campaigns (not committed)
     */
    public record CurrencySummary(String currency, BigDecimal paidInYear, BigDecimal invoicedUnpaid,
                                  BigDecimal overdue, BigDecimal committedUnpaid, BigDecimal pipelineValue,
                                  List<MonthAmount> monthly) {}

    public record EarningsSummary(int year, LocalDate today, List<CurrencySummary> currencies,
                                  long activeCampaigns, long overduePayments) {}
}
