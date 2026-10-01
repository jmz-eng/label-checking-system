package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NoticeSaveRequest {

    @NotBlank(message = "请输入公告标题")
    private String title;

    @NotBlank(message = "请输入公告内容")
    private String content;

    private String noticeType;
    private String publishStatus;
}

