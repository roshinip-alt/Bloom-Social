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

/** An invoice/payment line recorded by hand. Unpaid while {@code paidDate} is null. */
@Entity
@Table(name = "payment_record")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PaymentRecord extends Timestamped {
    @Id
    private UUID id;
    @Column(name = "campaign_id")
    private UUID campaignId;
    private BigDecimal amount;
    private String currency;
    @Column(name = "invoice_reference")
    private String invoiceReference;
    @Column(name = "invoiced_date")
    private LocalDate invoicedDate;
    @Column(name = "due_date")
    private LocalDate dueDate;
    @Column(name = "paid_date")
    private LocalDate paidDate;
    private String note;

    public PaymentRecord(UUID id, UUID campaignId) {
        this.id = id;
        this.campaignId = campaignId;
    }

    public boolean isPaid() {
        return paidDate != null;
    }
}
