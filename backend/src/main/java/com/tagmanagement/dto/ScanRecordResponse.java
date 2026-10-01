package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScanRecordResponse {

    private Long id;
    private String labelCode;
    private String actionType;
    private String expectedSummary;
    private String scannedPayload;
    private String result;
    private String message;
    private String operatorName;
    private LocalDateTime createdAt;
}

