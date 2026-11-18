package com.bloom.analytics;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetricDefinitionRepository extends JpaRepository<MetricDefinition, String> {
    List<MetricDefinition> findAllByOrderByProviderAscMetricKeyAsc();

    List<MetricDefinition> findByProviderAndScopeOrderByMetricKeyAsc(String provider, String scope);
}
