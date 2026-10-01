package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserPasswordResetRequest {

    @NotBlank(message = "请输入新密码")
    @Size(min = 8, max = 72, message = "密码长度必须为 8 到 72 位")
    private String newPassword;
}
