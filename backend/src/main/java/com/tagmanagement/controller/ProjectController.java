package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.ProjectCreateRequest;
import com.tagmanagement.dto.ProjectResponse;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectService projectService;

    @GetMapping
    @RequirePermission("project:view")
    public ApiResponse<List<ProjectResponse>> list(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(projectService.list(keyword));
    }

    @PostMapping
    @RequirePermission("project:create")
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        return ApiResponse.ok(projectService.create(request));
    }
}

