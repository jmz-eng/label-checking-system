package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ProjectCreateRequest {

    @NotBlank(message = "请输入项目编号")
    private String projectCode;

    @NotBlank(message = "请输入项目名称")
    private String projectName;

    @NotBlank(message = "请输入供试品")
    private String testArticle;

    private String sponsor;
}

