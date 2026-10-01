package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RoleResponse {

    private Long id;
    private String roleCode;
    private String roleName;
    private String description;
    private Set<String> permissionCodes;
}

