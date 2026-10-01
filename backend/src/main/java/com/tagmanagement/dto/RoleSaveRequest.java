package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RoleSaveRequest {

    @NotBlank(message = "请输入角色编码")
    private String roleCode;

    @NotBlank(message = "请输入角色名称")
    private String roleName;

    private String description;
}

