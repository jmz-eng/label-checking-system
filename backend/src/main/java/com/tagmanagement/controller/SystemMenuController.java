package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.MenuResponse;
import com.tagmanagement.dto.MenuSaveRequest;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.MenuService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/system/menus")
public class SystemMenuController {

    private final MenuService menuService;

    @GetMapping
    @RequirePermission("menu:view")
    public ApiResponse<List<MenuResponse>> list() {
        return ApiResponse.ok(menuService.listAllTree());
    }

    @PostMapping
    @RequirePermission("menu:create")
    public ApiResponse<MenuResponse> create(@Valid @RequestBody MenuSaveRequest request) {
        return ApiResponse.ok(menuService.create(request));
    }

    @PutMapping("/{id}")
    @RequirePermission("menu:update")
    public ApiResponse<MenuResponse> update(@PathVariable Long id, @Valid @RequestBody MenuSaveRequest request) {
        return ApiResponse.ok(menuService.update(id, request));
    }
}

