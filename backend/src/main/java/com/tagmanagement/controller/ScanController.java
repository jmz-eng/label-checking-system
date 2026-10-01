package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.BindScanRequest;
import com.tagmanagement.dto.RecordScanRequest;
import com.tagmanagement.dto.ScanResultResponse;
import com.tagmanagement.dto.VerifyScanRequest;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.SampleTaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/scan")
public class ScanController {

    private final SampleTaskService sampleTaskService;

    @PostMapping("/bind")
    @RequirePermission("sample:bind")
    public ApiResponse<ScanResultResponse> bind(@Valid @RequestBody BindScanRequest request) {
        return ApiResponse.ok(sampleTaskService.bind(request));
    }

    @PostMapping("/verify")
    @RequirePermission("sample:verify")
    public ApiResponse<ScanResultResponse> verify(@Valid @RequestBody VerifyScanRequest request) {
        return ApiResponse.ok(sampleTaskService.verify(request));
    }

    @PostMapping("/record")
    @RequirePermission("sample:record")
    public ApiResponse<ScanResultResponse> record(@Valid @RequestBody RecordScanRequest request) {
        return ApiResponse.ok(sampleTaskService.record(request));
    }
}

