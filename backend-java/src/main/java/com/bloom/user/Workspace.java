package com.bloom.user;

import com.bloom.common.persistence.Timestamped;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "workspace")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Workspace extends Timestamped {
    @Id
    private UUID id;
    private String name;
    private String timezone;
    @Column(name = "default_currency")
    private String defaultCurrency;
    @Column(name = "is_demo")
    private boolean demo;

    public Workspace(UUID id, String name, String timezone, String defaultCurrency, boolean demo) {
        this.id = id;
        this.name = name;
        this.timezone = timezone;
        this.defaultCurrency = defaultCurrency;
        this.demo = demo;
    }
}
