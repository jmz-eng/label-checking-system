package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class BindScanRequest {

    @NotBlank(message = "请扫描标签码")
    private String labelCode;

    @NotBlank(message = "请输入或扫描动物号")
    private String animalNo;
}

