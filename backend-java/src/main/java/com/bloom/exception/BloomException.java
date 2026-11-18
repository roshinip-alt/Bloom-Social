package com.bloom.exception;

import org.springframework.http.HttpStatus;

/** Base type for errors that map to a stable API error code and HTTP status. */
public class BloomException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public BloomException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }

    public static BloomException notFound(String what) {
        return new BloomException(HttpStatus.NOT_FOUND, "NOT_FOUND", what + " not found");
    }

    public static BloomException conflict(String code, String message) {
        return new BloomException(HttpStatus.CONFLICT, code, message);
    }

    public static BloomException badRequest(String code, String message) {
        return new BloomException(HttpStatus.BAD_REQUEST, code, message);
    }

    public static BloomException unprocessable(String code, String message) {
        return new BloomException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
    }

    public static BloomException unavailable(String code, String message) {
        return new BloomException(HttpStatus.SERVICE_UNAVAILABLE, code, message);
    }
}
