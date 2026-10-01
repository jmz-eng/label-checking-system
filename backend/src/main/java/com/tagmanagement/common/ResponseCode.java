package com.tagmanagement.common;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ResponseCode {

    SUCCESS(200, "操作成功", HttpStatus.OK),
    BAD_REQUEST(400, "请求参数不正确", HttpStatus.BAD_REQUEST),
    UNAUTHORIZED(401, "请先登录", HttpStatus.UNAUTHORIZED),
    FORBIDDEN(403, "当前账号无权执行该操作", HttpStatus.FORBIDDEN),
    NOT_FOUND(404, "请求的资源不存在", HttpStatus.NOT_FOUND),
    CONFLICT(409, "数据状态冲突", HttpStatus.CONFLICT),
    INTERNAL_ERROR(500, "系统暂时无法处理请求，请稍后重试", HttpStatus.INTERNAL_SERVER_ERROR);

    private final int code;
    private final String message;
    private final HttpStatus status;

    ResponseCode(int code, String message, HttpStatus status) {
        this.code = code;
        this.message = message;
        this.status = status;
    }
}
