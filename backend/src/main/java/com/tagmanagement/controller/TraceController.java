package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.AuditLogResponse;
import com.tagmanagement.dto.ScanRecordResponse;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.AuditLogService;
import com.tagmanagement.service.TraceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class TraceController {

    private final TraceService traceService;
    private final AuditLogService auditLogService;

    @GetMapping("/api/scan-records")
    @RequirePermission("record:view")
    public ApiResponse<List<ScanRecordResponse>> scanRecords(@RequestParam(required = false) String labelCode) {
        return ApiResponse.ok(traceService.listScanRecords(labelCode));
    }

    @GetMapping("/api/audit-logs")
    @RequirePermission("audit:view")
    public ApiResponse<List<AuditLogResponse>> auditLogs(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(auditLogService.list(keyword));
    }

    @GetMapping("/api/system/logs")
    @RequirePermission("log:view")
    public ApiResponse<List<AuditLogResponse>> systemLogs(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(auditLogService.list(keyword));
    }
}
