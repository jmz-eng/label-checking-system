package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {

    private Long id;
    private String operatorName;
    private String module;
    private String operation;
    private String businessKey;
    private String detail;
    private LocalDateTime createdAt;
}

