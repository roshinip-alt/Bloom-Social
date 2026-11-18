package com.bloom.brand;

import com.bloom.brand.BrandDtos.*;
import jakarta.validation.Valid;
import java.time.Year;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class BrandController {
    private final BrandService service;

    public BrandController(BrandService service) {
        this.service = service;
    }

    // ---- brands (CRM)
    @GetMapping("/brands")
    public List<BrandView> brands(@RequestParam(required = false) String q) {
        return service.brands(q);
    }

    @PostMapping("/brands")
    @ResponseStatus(HttpStatus.CREATED)
    public BrandView createBrand(@Valid @RequestBody BrandRequest body) {
        return service.createBrand(body);
    }

    @PutMapping("/brands/{id}")
    public BrandView updateBrand(@PathVariable UUID id, @Valid @RequestBody BrandRequest body) {
        return service.updateBrand(id, body);
    }

    @DeleteMapping("/brands/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBrand(@PathVariable UUID id) {
        service.deleteBrand(id);
    }

    // ---- campaigns
    @GetMapping("/campaigns")
    public List<CampaignView> campaigns(@RequestParam(required = false) Campaign.Stage stage,
                                        @RequestParam(required = false) UUID brandId) {
        return service.campaigns(stage, brandId);
    }

    @GetMapping("/campaigns/{id}")
    public CampaignView campaign(@PathVariable UUID id) {
        return service.campaign(id);
    }

    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignView createCampaign(@Valid @RequestBody CampaignRequest body) {
        return service.createCampaign(body);
    }

    @PutMapping("/campaigns/{id}")
    public CampaignView updateCampaign(@PathVariable UUID id, @Valid @RequestBody CampaignRequest body) {
        return service.updateCampaign(id, body);
    }

    @PatchMapping("/campaigns/{id}/stage")
    public CampaignView stage(@PathVariable UUID id, @Valid @RequestBody StageRequest body) {
        return service.moveStage(id, body.stage());
    }

    @DeleteMapping("/campaigns/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCampaign(@PathVariable UUID id) {
        service.deleteCampaign(id);
    }

    // ---- deliverables
    @PostMapping("/campaigns/{id}/deliverables")
    @ResponseStatus(HttpStatus.CREATED)
    public DeliverableView addDeliverable(@PathVariable UUID id, @Valid @RequestBody DeliverableRequest body) {
        return service.addDeliverable(id, body);
    }

    @PutMapping("/campaigns/{id}/deliverables/{deliverableId}")
    public DeliverableView updateDeliverable(@PathVariable UUID id, @PathVariable UUID deliverableId,
                                             @Valid @RequestBody DeliverableRequest body) {
        return service.updateDeliverable(id, deliverableId, body);
    }

    @DeleteMapping("/campaigns/{id}/deliverables/{deliverableId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDeliverable(@PathVariable UUID id, @PathVariable UUID deliverableId) {
        service.deleteDeliverable(id, deliverableId);
    }

    // ---- payments
    @PostMapping("/campaigns/{id}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public PaymentView addPayment(@PathVariable UUID id, @Valid @RequestBody PaymentRequest body) {
        return service.addPayment(id, body);
    }

    @PutMapping("/campaigns/{id}/payments/{paymentId}")
    public PaymentView updatePayment(@PathVariable UUID id, @PathVariable UUID paymentId,
                                     @Valid @RequestBody PaymentRequest body) {
        return service.updatePayment(id, paymentId, body);
    }

    @DeleteMapping("/campaigns/{id}/payments/{paymentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePayment(@PathVariable UUID id, @PathVariable UUID paymentId) {
        service.deletePayment(id, paymentId);
    }

    // ---- earnings
    @GetMapping("/earnings/summary")
    public EarningsSummary earnings(@RequestParam(required = false) Integer year) {
        return service.earnings(year != null ? year : Year.now().getValue());
    }
}
