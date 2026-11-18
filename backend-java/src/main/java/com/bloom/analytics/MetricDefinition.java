package com.bloom.analytics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "metric_definition")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MetricDefinition {
    @Id
    @Column(name = "metric_key")
    private String metricKey;
    private String provider;
    @Column(name = "source_metric")
    private String sourceMetric;
    @Column(name = "canonical_key")
    private String canonicalKey;
    private String scope;
    private String label;
    private String description;
    private String unit;
    @Column(name = "measure_type")
    private String measureType;
    @Column(name = "api_source")
    private String apiSource;

    public boolean isFlow() {
        return "FLOW".equals(measureType);
    }
}
