package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.dto.AuditLogResponse;
import com.tagmanagement.entity.AuditLog;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.mapper.AuditLogMapper;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditLogService {

    private final AuditLogMapper auditLogMapper;
    private final SysUserMapper userMapper;

    public void record(String module, String operation, String businessKey, String detail) {
        record(CurrentUserContext.getUserIdOrNull(), module, operation, businessKey, detail);
    }

    public void record(Long userId, String module, String operation, String businessKey, String detail) {
        AuditLog log = new AuditLog();
        log.setUserId(userId);
        log.setModule(module);
        log.setOperation(operation);
        log.setBusinessKey(businessKey);
        log.setDetail(detail);
        auditLogMapper.insert(log);
    }

    public List<AuditLogResponse> list(String keyword) {
        LambdaQueryWrapper<AuditLog> wrapper = new LambdaQueryWrapper<AuditLog>()
                .orderByDesc(AuditLog::getCreatedAt);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(AuditLog::getModule, keyword)
                    .or()
                    .like(AuditLog::getOperation, keyword)
                    .or()
                    .like(AuditLog::getBusinessKey, keyword)
                    .or()
                    .like(AuditLog::getDetail, keyword));
        }
        return auditLogMapper.selectList(wrapper).stream()
                .map(this::toResponse)
                .toList();
    }

    private AuditLogResponse toResponse(AuditLog log) {
        SysUser user = log.getUserId() == null ? null : userMapper.selectById(log.getUserId());
        return new AuditLogResponse(
                log.getId(),
                user == null ? "系统" : user.getRealName(),
                log.getModule(),
                log.getOperation(),
                log.getBusinessKey(),
                log.getDetail(),
                log.getCreatedAt()
        );
    }
}

