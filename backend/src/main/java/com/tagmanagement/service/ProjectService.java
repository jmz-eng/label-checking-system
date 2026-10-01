package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.ProjectCreateRequest;
import com.tagmanagement.dto.ProjectResponse;
import com.tagmanagement.entity.ProjectInfo;
import com.tagmanagement.mapper.ProjectInfoMapper;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectInfoMapper projectMapper;
    private final AuditLogService auditLogService;

    public List<ProjectResponse> list(String keyword) {
        LambdaQueryWrapper<ProjectInfo> wrapper = new LambdaQueryWrapper<ProjectInfo>()
                .orderByDesc(ProjectInfo::getCreatedAt);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(ProjectInfo::getProjectCode, keyword)
                    .or()
                    .like(ProjectInfo::getProjectName, keyword)
                    .or()
                    .like(ProjectInfo::getTestArticle, keyword));
        }
        return projectMapper.selectList(wrapper).stream().map(this::toResponse).toList();
    }

    public ProjectResponse create(ProjectCreateRequest request) {
        ProjectInfo existed = projectMapper.selectOne(new LambdaQueryWrapper<ProjectInfo>()
                .eq(ProjectInfo::getProjectCode, request.getProjectCode()));
        if (existed != null) {
            throw BusinessException.conflict("项目编号已存在");
        }
        ProjectInfo project = new ProjectInfo();
        project.setProjectCode(request.getProjectCode().trim());
        project.setProjectName(request.getProjectName().trim());
        project.setTestArticle(request.getTestArticle().trim());
        project.setSponsor(StringUtils.hasText(request.getSponsor()) ? request.getSponsor().trim() : null);
        project.setOwnerId(CurrentUserContext.get().getId());
        project.setStatus(BusinessConstants.STATUS_ACTIVE);
        projectMapper.insert(project);
        auditLogService.record("项目", "创建项目", project.getProjectCode(), "创建项目：" + project.getProjectName());
        return toResponse(project);
    }

    public ProjectInfo getById(Long projectId) {
        ProjectInfo project = projectMapper.selectById(projectId);
        if (project == null) {
            throw BusinessException.notFound("项目不存在");
        }
        return project;
    }

    public ProjectResponse toResponse(ProjectInfo project) {
        return new ProjectResponse(
                project.getId(),
                project.getProjectCode(),
                project.getProjectName(),
                project.getTestArticle(),
                project.getSponsor(),
                project.getStatus(),
                project.getCreatedAt()
        );
    }
}

