package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RecordScanRequest {

    @NotBlank(message = "请扫描标签码")
    private String labelCode;

    private String resultNote;
}

