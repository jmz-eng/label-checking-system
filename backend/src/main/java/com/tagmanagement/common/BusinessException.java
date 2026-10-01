package com.tagmanagement.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class BusinessException extends RuntimeException {

    private final int code;
    private final HttpStatus status;

    public BusinessException(ResponseCode responseCode) {
        this(responseCode, responseCode.getMessage());
    }

    public BusinessException(ResponseCode responseCode, String message) {
        this(responseCode.getStatus(), responseCode.getCode(), message);
    }

    private BusinessException(HttpStatus status, int code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static BusinessException badRequest(String message) {
        return new BusinessException(ResponseCode.BAD_REQUEST, message);
    }

    public static BusinessException unauthorized(String message) {
        return new BusinessException(ResponseCode.UNAUTHORIZED, message);
    }

    public static BusinessException forbidden(String message) {
        return new BusinessException(ResponseCode.FORBIDDEN, message);
    }

    public static BusinessException conflict(String message) {
        return new BusinessException(ResponseCode.CONFLICT, message);
    }

    public static BusinessException notFound(String message) {
        return new BusinessException(ResponseCode.NOT_FOUND, message);
    }
}
