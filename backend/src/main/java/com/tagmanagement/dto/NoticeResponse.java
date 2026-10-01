package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NoticeResponse {

    private Long id;
    private String title;
    private String content;
    private String noticeType;
    private String publishStatus;
    private String creatorName;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
}

