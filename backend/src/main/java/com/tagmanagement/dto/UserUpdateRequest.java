package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UserUpdateRequest {

    @NotBlank(message = "请输入姓名")
    @Size(max = 64, message = "姓名不能超过 64 个字符")
    private String realName;

    @Size(max = 128, message = "部门不能超过 128 个字符")
    private String department;

    @NotBlank(message = "请选择用户状态")
    @Pattern(regexp = "ENABLED|DISABLED", message = "用户状态只能是 ENABLED 或 DISABLED")
    private String status;

    @NotEmpty(message = "请至少分配一个角色")
    private List<Long> roleIds;
}
