package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.UserCreateRequest;
import com.tagmanagement.dto.UserManagementResponse;
import com.tagmanagement.dto.UserPasswordResetRequest;
import com.tagmanagement.dto.UserUpdateRequest;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.UserManagementService;
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
@RequestMapping("/api/system/users")
public class UserManagementController {

    private final UserManagementService userManagementService;

    @GetMapping
    @RequirePermission("user:view")
    public ApiResponse<List<UserManagementResponse>> list(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(userManagementService.list(keyword));
    }

    @PostMapping
    @RequirePermission("user:create")
    public ApiResponse<UserManagementResponse> create(@Valid @RequestBody UserCreateRequest request) {
        return ApiResponse.ok(userManagementService.create(request));
    }

    @PutMapping("/{id}")
    @RequirePermission("user:update")
    public ApiResponse<UserManagementResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UserUpdateRequest request
    ) {
        return ApiResponse.ok(userManagementService.update(id, request));
    }

    @PutMapping("/{id}/password")
    @RequirePermission("user:reset-password")
    public ApiResponse<Void> resetPassword(
            @PathVariable Long id,
            @Valid @RequestBody UserPasswordResetRequest request
    ) {
        userManagementService.resetPassword(id, request);
        return ApiResponse.ok();
    }
}
