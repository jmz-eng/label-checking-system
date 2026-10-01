package com.tagmanagement.controller;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.dto.NoticeResponse;
import com.tagmanagement.dto.NoticeSaveRequest;
import com.tagmanagement.security.RequirePermission;
import com.tagmanagement.service.NoticeService;
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
public class NoticeController {

    private final NoticeService noticeService;

    @GetMapping("/api/notices")
    public ApiResponse<List<NoticeResponse>> published() {
        return ApiResponse.ok(noticeService.listPublished());
    }

    @GetMapping("/api/system/notices")
    @RequirePermission("notice:view")
    public ApiResponse<List<NoticeResponse>> list(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(noticeService.listAll(keyword));
    }

    @PostMapping("/api/system/notices")
    @RequirePermission("notice:create")
    public ApiResponse<NoticeResponse> create(@Valid @RequestBody NoticeSaveRequest request) {
        return ApiResponse.ok(noticeService.create(request));
    }

    @PutMapping("/api/system/notices/{id}")
    @RequirePermission("notice:update")
    public ApiResponse<NoticeResponse> update(@PathVariable Long id, @Valid @RequestBody NoticeSaveRequest request) {
        return ApiResponse.ok(noticeService.update(id, request));
    }

    @PostMapping("/api/system/notices/{id}/publish")
    @RequirePermission("notice:publish")
    public ApiResponse<NoticeResponse> publish(@PathVariable Long id) {
        return ApiResponse.ok(noticeService.publish(id));
    }
}

