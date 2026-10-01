package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.GenerateSampleTasksRequest;
import com.tagmanagement.dto.SampleTaskResponse;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.SampleTaskService;
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
@RequestMapping("/api/sample-tasks")
public class SampleTaskController {

    private final SampleTaskService sampleTaskService;

    @GetMapping
    @RequirePermission("sample:view")
    public ApiResponse<List<SampleTaskResponse>> list(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword
    ) {
        return ApiResponse.ok(sampleTaskService.list(projectId, status, keyword));
    }

    @PostMapping("/generate")
    @RequirePermission("sample:generate")
    public ApiResponse<List<SampleTaskResponse>> generate(@Valid @RequestBody GenerateSampleTasksRequest request) {
        return ApiResponse.ok(sampleTaskService.generate(request));
    }
}

