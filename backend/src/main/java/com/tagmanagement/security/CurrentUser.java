package com.tagmanagement.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CurrentUser {

    private Long id;
    private String username;
    private String realName;
    private Set<String> roles;
    private Set<String> permissions;

    public boolean hasPermission(String permissionCode) {
        return permissions != null && (permissions.contains("*") || permissions.contains(permissionCode));
    }
}

