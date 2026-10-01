package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScanResultResponse {

    private boolean passed;
    private String message;
    private String taskStatus;
    private SampleTaskResponse task;
}

