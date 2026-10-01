package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.LoginRequest;
import com.tagmanagement.dto.LoginResponse;
import com.tagmanagement.dto.UserProfileResponse;
import com.tagmanagement.entity.SysPermission;
import com.tagmanagement.entity.SysRole;
import com.tagmanagement.entity.SysRolePermission;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.entity.SysUserRole;
import com.tagmanagement.mapper.SysPermissionMapper;
import com.tagmanagement.mapper.SysRoleMapper;
import com.tagmanagement.mapper.SysRolePermissionMapper;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.mapper.SysUserRoleMapper;
import com.tagmanagement.security.CurrentUser;
import com.tagmanagement.security.TokenService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final SysPermissionMapper permissionMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final BCryptPasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final AuditLogService auditLogService;

    public LoginResponse login(LoginRequest request) {
        SysUser user = userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, request.getUsername()));
        if (user == null || !BusinessConstants.STATUS_ENABLED.equals(user.getStatus())
                || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw BusinessException.badRequest("账号或密码错误");
        }
        String token = tokenService.createToken(user);
        auditLogService.record(user.getId(), "认证", "登录", user.getUsername(), "用户登录系统");
        return new LoginResponse(token, buildProfile(user));
    }

    public CurrentUser buildCurrentUser(Long userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null || !BusinessConstants.STATUS_ENABLED.equals(user.getStatus())) {
            throw BusinessException.unauthorized("账号不存在或已停用");
        }
        return new CurrentUser(
                user.getId(),
                user.getUsername(),
                user.getRealName(),
                findRoleCodes(userId),
                findPermissionCodes(userId)
        );
    }

    public UserProfileResponse getProfile(Long userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }
        return buildProfile(user);
    }

    private UserProfileResponse buildProfile(SysUser user) {
        return new UserProfileResponse(
                user.getId(),
                user.getUsername(),
                user.getRealName(),
                user.getDepartment(),
                findRoleCodes(user.getId()),
                findPermissionCodes(user.getId())
        );
    }

    private Set<String> findRoleCodes(Long userId) {
        List<Long> roleIds = findRoleIds(userId);
        if (roleIds.isEmpty()) {
            return Collections.emptySet();
        }
        return roleMapper.selectBatchIds(roleIds).stream()
                .map(SysRole::getRoleCode)
                .collect(Collectors.toSet());
    }

    private Set<String> findPermissionCodes(Long userId) {
        List<Long> roleIds = findRoleIds(userId);
        if (roleIds.isEmpty()) {
            return Collections.emptySet();
        }
        List<Long> permissionIds = rolePermissionMapper.selectList(
                        new LambdaQueryWrapper<SysRolePermission>().in(SysRolePermission::getRoleId, roleIds)
                ).stream()
                .map(SysRolePermission::getPermissionId)
                .distinct()
                .toList();
        if (permissionIds.isEmpty()) {
            return Collections.emptySet();
        }
        return permissionMapper.selectBatchIds(permissionIds).stream()
                .map(SysPermission::getPermissionCode)
                .collect(Collectors.toSet());
    }

    private List<Long> findRoleIds(Long userId) {
        return userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                        .eq(SysUserRole::getUserId, userId))
                .stream()
                .map(SysUserRole::getRoleId)
                .distinct()
                .toList();
    }
}

