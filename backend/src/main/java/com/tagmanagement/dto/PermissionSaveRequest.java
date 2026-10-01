package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PermissionSaveRequest {

    @NotBlank(message = "请输入权限编码")
    private String permissionCode;

    @NotBlank(message = "请输入权限名称")
    private String permissionName;

    @NotBlank(message = "请输入所属模块")
    private String module;
}

