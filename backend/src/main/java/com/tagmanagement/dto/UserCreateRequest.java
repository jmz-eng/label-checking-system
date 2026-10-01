package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserCreateRequest {

    @NotBlank(message = "请输入用户名")
    @Size(min = 4, max = 64, message = "用户名长度必须为 4 到 64 位")
    @Pattern(regexp = "^[A-Za-z0-9._-]+$", message = "用户名只能包含字母、数字、点、下划线和横线")
    private String username;

    @NotBlank(message = "请输入初始密码")
    @Size(min = 8, max = 72, message = "密码长度必须为 8 到 72 位")
    private String password;

    @NotBlank(message = "请输入姓名")
    @Size(max = 64, message = "姓名不能超过 64 个字符")
    private String realName;

    @Size(max = 128, message = "部门不能超过 128 个字符")
    private String department;

    @Pattern(regexp = "ENABLED|DISABLED", message = "用户状态只能是 ENABLED 或 DISABLED")
    private String status;

    @NotEmpty(message = "请至少分配一个角色")
    private List<Long> roleIds;
}
