package com.tagmanagement.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class RolePermissionUpdateRequest {

    @NotNull(message = "请选择权限")
    private List<String> permissionCodes;
}

