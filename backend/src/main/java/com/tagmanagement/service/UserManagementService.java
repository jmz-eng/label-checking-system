package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.UserCreateRequest;
import com.tagmanagement.dto.UserManagementResponse;
import com.tagmanagement.dto.UserPasswordResetRequest;
import com.tagmanagement.dto.UserUpdateRequest;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.entity.SysUserRole;
import com.tagmanagement.mapper.SysRoleMapper;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.mapper.SysUserRoleMapper;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class UserManagementService {

    private final SysUserMapper userMapper;
    private final SysRoleMapper roleMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final BCryptPasswordEncoder passwordEncoder;
    private final AuditLogService auditLogService;

    public List<UserManagementResponse> list(String keyword) {
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<SysUser>()
                .orderByAsc(SysUser::getUsername);
        if (StringUtils.hasText(keyword)) {
            String searchKeyword = keyword.trim();
            wrapper.and(query -> query.like(SysUser::getUsername, searchKeyword)
                    .or()
                    .like(SysUser::getRealName, searchKeyword)
                    .or()
                    .like(SysUser::getDepartment, searchKeyword));
        }
        List<SysUser> users = userMapper.selectList(wrapper);
        return buildResponses(users);
    }

    @Transactional
    public UserManagementResponse create(UserCreateRequest request) {
        String username = request.getUsername().trim();
        if (userMapper.selectOne(new LambdaQueryWrapper<SysUser>()
                .eq(SysUser::getUsername, username)) != null) {
            throw BusinessException.conflict("用户名已存在");
        }
        List<Long> roleIds = validateRoleIds(request.getRoleIds());
        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRealName(request.getRealName().trim());
        user.setDepartment(trimToNull(request.getDepartment()));
        user.setStatus(normalizeCreateStatus(request.getStatus()));
        userMapper.insert(user);
        replaceRoles(user.getId(), roleIds);
        auditLogService.record("用户", "新增用户", username, "新增用户并分配角色：" + user.getRealName());
        return getById(user.getId());
    }

    @Transactional
    public UserManagementResponse update(Long id, UserUpdateRequest request) {
        SysUser user = requireUser(id);
        boolean updatingCurrentUser = id.equals(CurrentUserContext.getUserIdOrNull());
        if (updatingCurrentUser && BusinessConstants.STATUS_DISABLED.equals(request.getStatus())) {
            throw BusinessException.badRequest("不能停用当前登录账号");
        }
        List<Long> roleIds = validateRoleIds(request.getRoleIds());
        if (updatingCurrentUser) {
            if (!new LinkedHashSet<>(findRoleIds(id)).equals(new LinkedHashSet<>(roleIds))) {
                throw BusinessException.badRequest("不能修改当前登录账号的角色");
            }
        }
        user.setRealName(request.getRealName().trim());
        user.setDepartment(trimToNull(request.getDepartment()));
        user.setStatus(request.getStatus());
        userMapper.updateById(user);
        replaceRoles(id, roleIds);
        auditLogService.record("用户", "编辑用户", user.getUsername(), "更新用户资料、状态和角色：" + user.getRealName());
        return getById(id);
    }

    @Transactional
    public void resetPassword(Long id, UserPasswordResetRequest request) {
        SysUser user = requireUser(id);
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userMapper.updateById(user);
        auditLogService.record("用户", "重置密码", user.getUsername(), "重置用户密码：" + user.getRealName());
    }

    private UserManagementResponse getById(Long id) {
        return buildResponses(List.of(requireUser(id))).get(0);
    }

    private SysUser requireUser(Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw BusinessException.notFound("用户不存在");
        }
        return user;
    }

    private List<Long> validateRoleIds(List<Long> requestedRoleIds) {
        List<Long> roleIds = new ArrayList<>(new LinkedHashSet<>(requestedRoleIds));
        if (roleIds.isEmpty()) {
            throw BusinessException.badRequest("请至少分配一个角色");
        }
        if (roleMapper.selectBatchIds(roleIds).size() != roleIds.size()) {
            throw BusinessException.badRequest("包含不存在的角色");
        }
        return roleIds;
    }

    private void replaceRoles(Long userId, List<Long> roleIds) {
        userRoleMapper.delete(new LambdaQueryWrapper<SysUserRole>()
                .eq(SysUserRole::getUserId, userId));
        for (Long roleId : roleIds) {
            SysUserRole relation = new SysUserRole();
            relation.setUserId(userId);
            relation.setRoleId(roleId);
            userRoleMapper.insert(relation);
        }
    }

    private List<Long> findRoleIds(Long userId) {
        return userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                        .eq(SysUserRole::getUserId, userId))
                .stream()
                .map(SysUserRole::getRoleId)
                .toList();
    }

    private List<UserManagementResponse> buildResponses(List<SysUser> users) {
        if (users.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> userIds = users.stream().map(SysUser::getId).toList();
        List<SysUserRole> relations = userRoleMapper.selectList(new LambdaQueryWrapper<SysUserRole>()
                .in(SysUserRole::getUserId, userIds));
        Map<Long, List<Long>> roleIdsByUser = new LinkedHashMap<>();
        relations.forEach(relation -> roleIdsByUser
                .computeIfAbsent(relation.getUserId(), key -> new ArrayList<>())
                .add(relation.getRoleId()));
        List<Long> roleIds = relations.stream().map(SysUserRole::getRoleId).distinct().toList();
        Map<Long, String> roleNameById = new LinkedHashMap<>();
        if (!roleIds.isEmpty()) {
            roleMapper.selectBatchIds(roleIds).forEach(role -> roleNameById.put(role.getId(), role.getRoleName()));
        }
        return users.stream().map(user -> {
            List<Long> userRoleIds = roleIdsByUser.getOrDefault(user.getId(), Collections.emptyList());
            List<String> roleNames = userRoleIds.stream()
                    .map(roleNameById::get)
                    .filter(StringUtils::hasText)
                    .toList();
            return new UserManagementResponse(
                    user.getId(),
                    user.getUsername(),
                    user.getRealName(),
                    user.getDepartment(),
                    user.getStatus(),
                    userRoleIds,
                    roleNames,
                    user.getCreatedAt(),
                    user.getUpdatedAt()
            );
        }).toList();
    }

    private String normalizeCreateStatus(String status) {
        return StringUtils.hasText(status) ? status : BusinessConstants.STATUS_ENABLED;
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
