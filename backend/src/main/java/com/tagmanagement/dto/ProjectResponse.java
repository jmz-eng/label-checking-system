package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ProjectResponse {

    private Long id;
    private String projectCode;
    private String projectName;
    private String testArticle;
    private String sponsor;
    private String status;
    private LocalDateTime createdAt;
}

