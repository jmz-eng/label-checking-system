package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.WorkbenchSummaryResponse;
import com.tagmanagement.service.WorkbenchService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workbench")
public class WorkbenchController {

    private final WorkbenchService workbenchService;

    @GetMapping("/summary")
    public ApiResponse<WorkbenchSummaryResponse> summary() {
        return ApiResponse.ok(workbenchService.summary());
    }
}
