package com.tagmanagement.service;

import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.UserCreateRequest;
import com.tagmanagement.dto.UserPasswordResetRequest;
import com.tagmanagement.dto.UserUpdateRequest;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.entity.SysRole;
import com.tagmanagement.entity.SysUserRole;
import com.tagmanagement.mapper.SysRoleMapper;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.mapper.SysUserRoleMapper;
import com.tagmanagement.security.CurrentUser;
import com.tagmanagement.security.CurrentUserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private SysUserMapper userMapper;

    @Mock
    private SysRoleMapper roleMapper;

    @Mock
    private SysUserRoleMapper userRoleMapper;

    @Mock
    private BCryptPasswordEncoder passwordEncoder;

    @Mock
    private AuditLogService auditLogService;

    @InjectMocks
    private UserManagementService userManagementService;

    @AfterEach
    void clearCurrentUser() {
        CurrentUserContext.clear();
    }

    @Test
    void shouldRejectDuplicateUsername() {
        UserCreateRequest request = createRequest();
        when(userMapper.selectOne(any())).thenReturn(user(2L, "operator01"));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userManagementService.create(request)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatus());
        verify(userMapper, never()).insert(any(SysUser.class));
    }

    @Test
    void shouldRejectUnknownRole() {
        UserCreateRequest request = createRequest();
        when(userMapper.selectOne(any())).thenReturn(null);
        when(roleMapper.selectBatchIds(List.of(9L))).thenReturn(List.of());

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userManagementService.create(request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(userMapper, never()).insert(any(SysUser.class));
    }

    @Test
    void shouldPreventCurrentUserFromDisablingSelf() {
        CurrentUserContext.set(new CurrentUser(1L, "admin", "管理员", Set.of("ADMIN"), Set.of("*")));
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin"));
        UserUpdateRequest request = new UserUpdateRequest();
        request.setRealName("管理员");
        request.setStatus("DISABLED");
        request.setRoleIds(List.of(1L));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userManagementService.update(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(userMapper, never()).updateById(any(SysUser.class));
    }

    @Test
    void shouldPreventCurrentUserFromChangingOwnRoles() {
        CurrentUserContext.set(new CurrentUser(1L, "admin", "管理员", Set.of("ADMIN"), Set.of("*")));
        when(userMapper.selectById(1L)).thenReturn(user(1L, "admin"));
        SysRole role = new SysRole();
        role.setId(2L);
        when(roleMapper.selectBatchIds(List.of(2L))).thenReturn(List.of(role));
        SysUserRole currentRole = new SysUserRole();
        currentRole.setUserId(1L);
        currentRole.setRoleId(1L);
        when(userRoleMapper.selectList(any())).thenReturn(List.of(currentRole));
        UserUpdateRequest request = new UserUpdateRequest();
        request.setRealName("管理员");
        request.setStatus("ENABLED");
        request.setRoleIds(List.of(2L));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> userManagementService.update(1L, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatus());
        verify(userMapper, never()).updateById(any(SysUser.class));
    }

    @Test
    void shouldHashPasswordWithoutWritingPlaintextToAuditLog() {
        SysUser user = user(2L, "operator01");
        when(userMapper.selectById(2L)).thenReturn(user);
        when(passwordEncoder.encode("NewPassword123!")).thenReturn("bcrypt-hash");
        UserPasswordResetRequest request = new UserPasswordResetRequest();
        request.setNewPassword("NewPassword123!");

        userManagementService.resetPassword(2L, request);

        assertEquals("bcrypt-hash", user.getPasswordHash());
        verify(userMapper).updateById(user);
        ArgumentCaptor<String> detailCaptor = ArgumentCaptor.forClass(String.class);
        verify(auditLogService).record(
                org.mockito.ArgumentMatchers.eq("用户"),
                org.mockito.ArgumentMatchers.eq("重置密码"),
                org.mockito.ArgumentMatchers.eq("operator01"),
                detailCaptor.capture()
        );
        assertFalse(detailCaptor.getValue().contains("NewPassword123!"));
    }

    private UserCreateRequest createRequest() {
        UserCreateRequest request = new UserCreateRequest();
        request.setUsername("operator01");
        request.setPassword("StrongPassword123!");
        request.setRealName("操作员一");
        request.setStatus("ENABLED");
        request.setRoleIds(List.of(9L));
        return request;
    }

    private SysUser user(Long id, String username) {
        SysUser user = new SysUser();
        user.setId(id);
        user.setUsername(username);
        user.setRealName("测试用户");
        user.setStatus("ENABLED");
        return user;
    }
}
