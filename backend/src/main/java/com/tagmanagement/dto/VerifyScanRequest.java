package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyScanRequest {

    @NotBlank(message = "请扫描标签码")
    private String labelCode;

    @NotBlank(message = "请输入项目号")
    private String projectCode;

    @NotBlank(message = "请输入动物号")
    private String animalNo;

    @NotBlank(message = "请输入时间点")
    private String timePoint;
}

