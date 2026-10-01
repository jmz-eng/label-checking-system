package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.PermissionResponse;
import com.tagmanagement.dto.PermissionSaveRequest;
import com.tagmanagement.dto.RolePermissionUpdateRequest;
import com.tagmanagement.dto.RoleResponse;
import com.tagmanagement.dto.RoleSaveRequest;
import com.tagmanagement.entity.SysPermission;
import com.tagmanagement.entity.SysRole;
import com.tagmanagement.entity.SysRolePermission;
import com.tagmanagement.mapper.SysPermissionMapper;
import com.tagmanagement.mapper.SysRoleMapper;
import com.tagmanagement.mapper.SysRolePermissionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PermissionManagementService {

    private final SysPermissionMapper permissionMapper;
    private final SysRoleMapper roleMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final AuditLogService auditLogService;

    public List<PermissionResponse> listPermissions(String keyword) {
        LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<SysPermission>()
                .orderByAsc(SysPermission::getModule)
                .orderByAsc(SysPermission::getPermissionCode);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SysPermission::getPermissionCode, keyword)
                    .or()
                    .like(SysPermission::getPermissionName, keyword)
                    .or()
                    .like(SysPermission::getModule, keyword));
        }
        return permissionMapper.selectList(wrapper).stream().map(this::toPermissionResponse).toList();
    }

    @Transactional
    public PermissionResponse createPermission(PermissionSaveRequest request) {
        if (permissionMapper.selectOne(new LambdaQueryWrapper<SysPermission>()
                .eq(SysPermission::getPermissionCode, request.getPermissionCode().trim())) != null) {
            throw BusinessException.conflict("权限编码已存在");
        }
        SysPermission permission = new SysPermission();
        permission.setPermissionCode(request.getPermissionCode().trim());
        permission.setPermissionName(request.getPermissionName().trim());
        permission.setModule(request.getModule().trim());
        permissionMapper.insert(permission);
        auditLogService.record("权限", "新增权限", permission.getPermissionCode(), "新增权限：" + permission.getPermissionName());
        return toPermissionResponse(permission);
    }

    public List<RoleResponse> listRoles() {
        return roleMapper.selectList(new LambdaQueryWrapper<SysRole>().orderByAsc(SysRole::getRoleCode))
                .stream()
                .map(this::toRoleResponse)
                .toList();
    }

    @Transactional
    public RoleResponse createRole(RoleSaveRequest request) {
        if (roleMapper.selectOne(new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getRoleCode, request.getRoleCode().trim())) != null) {
            throw BusinessException.conflict("角色编码已存在");
        }
        SysRole role = new SysRole();
        role.setRoleCode(request.getRoleCode().trim());
        role.setRoleName(request.getRoleName().trim());
        role.setDescription(StringUtils.hasText(request.getDescription()) ? request.getDescription().trim() : null);
        roleMapper.insert(role);
        auditLogService.record("权限", "新增角色", role.getRoleCode(), "新增角色：" + role.getRoleName());
        return toRoleResponse(role);
    }

    @Transactional
    public RoleResponse updateRolePermissions(Long roleId, RolePermissionUpdateRequest request) {
        SysRole role = roleMapper.selectById(roleId);
        if (role == null) {
            throw BusinessException.notFound("角色不存在");
        }
        rolePermissionMapper.delete(new LambdaQueryWrapper<SysRolePermission>()
                .eq(SysRolePermission::getRoleId, roleId));
        for (String code : request.getPermissionCodes()) {
            SysPermission permission = permissionMapper.selectOne(new LambdaQueryWrapper<SysPermission>()
                    .eq(SysPermission::getPermissionCode, code));
            if (permission == null) {
                throw BusinessException.badRequest("权限不存在：" + code);
            }
            SysRolePermission relation = new SysRolePermission();
            relation.setRoleId(roleId);
            relation.setPermissionId(permission.getId());
            rolePermissionMapper.insert(relation);
        }
        auditLogService.record("权限", "分配角色权限", role.getRoleCode(), "更新角色权限：" + role.getRoleName());
        return toRoleResponse(role);
    }

    private RoleResponse toRoleResponse(SysRole role) {
        return new RoleResponse(
                role.getId(),
                role.getRoleCode(),
                role.getRoleName(),
                role.getDescription(),
                findPermissionCodes(role.getId())
        );
    }

    private Set<String> findPermissionCodes(Long roleId) {
        List<Long> permissionIds = rolePermissionMapper.selectList(new LambdaQueryWrapper<SysRolePermission>()
                        .eq(SysRolePermission::getRoleId, roleId))
                .stream()
                .map(SysRolePermission::getPermissionId)
                .toList();
        if (permissionIds.isEmpty()) {
            return Collections.emptySet();
        }
        return permissionMapper.selectBatchIds(permissionIds).stream()
                .map(SysPermission::getPermissionCode)
                .collect(Collectors.toSet());
    }

    private PermissionResponse toPermissionResponse(SysPermission permission) {
        return new PermissionResponse(
                permission.getId(),
                permission.getPermissionCode(),
                permission.getPermissionName(),
                permission.getModule()
        );
    }
}

