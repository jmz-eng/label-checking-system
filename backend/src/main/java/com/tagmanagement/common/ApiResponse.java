package com.tagmanagement.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ApiResponse<T> {

    private int code;
    private String message;
    private T data;
    private LocalDateTime timestamp;

    public static <T> ApiResponse<T> ok(T data) {
        return of(ResponseCode.SUCCESS.getCode(), ResponseCode.SUCCESS.getMessage(), data);
    }

    public static ApiResponse<Void> ok() {
        return of(ResponseCode.SUCCESS.getCode(), ResponseCode.SUCCESS.getMessage(), null);
    }

    public static <T> ApiResponse<T> fail(ResponseCode responseCode) {
        return of(responseCode.getCode(), responseCode.getMessage(), null);
    }

    public static <T> ApiResponse<T> fail(int code, String message) {
        return of(code, message, null);
    }

    public static <T> ApiResponse<T> of(int code, String message, T data) {
        return new ApiResponse<>(code, message, data, LocalDateTime.now());
    }
}
