package com.bloom.social.connect;

import com.bloom.social.connect.ConnectDtos.*;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

/** Node → Java OAuth callbacks. Protected by InternalTokenFilter; never routed by the public proxy. */
@RestController
@RequestMapping("/internal/v1/oauth/sessions")
public class InternalOAuthController {
    private final ConnectService service;

    public InternalOAuthController(ConnectService service) {
        this.service = service;
    }

    @PostMapping("/resolve")
    public ResolveResponse resolve(@Valid @RequestBody ResolveRequest body) {
        return service.resolve(body);
    }

    @PostMapping("/{id}/complete")
    public CompleteResponse complete(@PathVariable UUID id, @Valid @RequestBody CompleteRequest body) {
        return service.complete(id, body);
    }

    @PostMapping("/{id}/fail")
    public CompleteResponse failById(@PathVariable UUID id, @RequestBody FailRequest body) {
        return service.failById(id, body.errorCode(), body.errorMessage());
    }

    @PostMapping("/fail")
    public CompleteResponse fail(@Valid @RequestBody FailRequest body) {
        return service.failByState(body);
    }
}
