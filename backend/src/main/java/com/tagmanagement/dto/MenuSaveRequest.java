package com.tagmanagement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MenuSaveRequest {

    @NotNull(message = "请选择上级菜单")
    private Long parentId;

    @NotBlank(message = "请输入菜单标识")
    private String menuKey;

    @NotBlank(message = "请输入菜单名称")
    private String menuName;

    private String routePath;
    private String component;
    private String permissionCode;
    private String icon;
    private Integer sortOrder;
    private Boolean visible;
    private String status;
}

