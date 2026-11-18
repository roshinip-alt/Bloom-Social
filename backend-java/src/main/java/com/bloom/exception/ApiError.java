package com.bloom.exception;

import java.util.List;

/** Uniform error body for every /api/v1 failure. Never contains secrets or stack traces. */
public record ApiError(String code, String message, String correlationId, List<FieldError> fieldErrors) {
    public record FieldError(String field, String message) {}
}
