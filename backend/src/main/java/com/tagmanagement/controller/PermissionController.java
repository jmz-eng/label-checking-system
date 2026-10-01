package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.PermissionResponse;
import com.tagmanagement.dto.PermissionSaveRequest;
import com.tagmanagement.dto.RolePermissionUpdateRequest;
import com.tagmanagement.dto.RoleResponse;
import com.tagmanagement.dto.RoleSaveRequest;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.PermissionManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/system")
public class PermissionController {

    private final PermissionManagementService permissionManagementService;

    @GetMapping("/permissions")
    @RequirePermission("permission:view")
    public ApiResponse<List<PermissionResponse>> permissions(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(permissionManagementService.listPermissions(keyword));
    }

    @PostMapping("/permissions")
    @RequirePermission("permission:manage")
    public ApiResponse<PermissionResponse> createPermission(@Valid @RequestBody PermissionSaveRequest request) {
        return ApiResponse.ok(permissionManagementService.createPermission(request));
    }

    @GetMapping("/roles")
    @RequirePermission("role:view")
    public ApiResponse<List<RoleResponse>> roles() {
        return ApiResponse.ok(permissionManagementService.listRoles());
    }

    @PostMapping("/roles")
    @RequirePermission("role:manage")
    public ApiResponse<RoleResponse> createRole(@Valid @RequestBody RoleSaveRequest request) {
        return ApiResponse.ok(permissionManagementService.createRole(request));
    }

    @PutMapping("/roles/{id}/permissions")
    @RequirePermission("role:manage")
    public ApiResponse<RoleResponse> updateRolePermissions(
            @PathVariable Long id,
            @Valid @RequestBody RolePermissionUpdateRequest request
    ) {
        return ApiResponse.ok(permissionManagementService.updateRolePermissions(id, request));
    }
}

