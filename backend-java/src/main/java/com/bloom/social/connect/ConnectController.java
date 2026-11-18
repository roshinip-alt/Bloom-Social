package com.bloom.social.connect;

import com.bloom.social.connect.ConnectDtos.*;
import com.bloom.social.domain.Provider;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/connections")
public class ConnectController {
    private final ConnectService service;

    public ConnectController(ConnectService service) {
        this.service = service;
    }

    /** Begin OAuth: returns the official provider authorization URL to redirect the browser to. */
    @PostMapping("/{provider}/start")
    public StartResponse start(@PathVariable String provider) {
        return service.start(Provider.fromSlug(provider));
    }

    @GetMapping("/sessions/{id}")
    public SessionView session(@PathVariable UUID id) {
        return service.view(id);
    }

    @PostMapping("/sessions/{id}/select")
    public SessionView select(@PathVariable UUID id, @Valid @RequestBody SelectRequest body) {
        return service.select(id, body);
    }

    @PostMapping("/sessions/{id}/cancel")
    public SessionView cancel(@PathVariable UUID id) {
        return service.cancel(id);
    }
}
