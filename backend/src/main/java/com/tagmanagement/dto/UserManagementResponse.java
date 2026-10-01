package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserManagementResponse {

    private Long id;
    private String username;
    private String realName;
    private String department;
    private String status;
    private List<Long> roleIds;
    private List<String> roleNames;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
