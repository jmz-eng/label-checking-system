package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MenuResponse {

    private Long id;
    private Long parentId;
    private String menuKey;
    private String menuName;
    private String routePath;
    private String component;
    private String permissionCode;
    private String icon;
    private Integer sortOrder;
    private Boolean visible;
    private String status;
    private List<MenuResponse> children = new ArrayList<>();
}

