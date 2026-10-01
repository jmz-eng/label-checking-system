package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.NoticeResponse;
import com.tagmanagement.dto.NoticeSaveRequest;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.entity.SystemNotice;
import com.tagmanagement.mapper.SysUserMapper;
import com.tagmanagement.mapper.SystemNoticeMapper;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NoticeService {

    private final SystemNoticeMapper noticeMapper;
    private final SysUserMapper userMapper;
    private final AuditLogService auditLogService;

    public List<NoticeResponse> listAll(String keyword) {
        LambdaQueryWrapper<SystemNotice> wrapper = new LambdaQueryWrapper<SystemNotice>()
                .orderByDesc(SystemNotice::getCreatedAt);
        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w.like(SystemNotice::getTitle, keyword)
                    .or()
                    .like(SystemNotice::getContent, keyword));
        }
        return noticeMapper.selectList(wrapper).stream().map(this::toResponse).toList();
    }

    public List<NoticeResponse> listPublished() {
        return noticeMapper.selectList(new LambdaQueryWrapper<SystemNotice>()
                        .eq(SystemNotice::getPublishStatus, "PUBLISHED")
                        .orderByDesc(SystemNotice::getPublishedAt)
                        .last("LIMIT 5"))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public NoticeResponse create(NoticeSaveRequest request) {
        SystemNotice notice = new SystemNotice();
        fillNotice(notice, request);
        notice.setCreatedBy(CurrentUserContext.get().getId());
        noticeMapper.insert(notice);
        auditLogService.record("公告", "新增公告", notice.getTitle(), "新增公告：" + notice.getTitle());
        return toResponse(notice);
    }

    @Transactional
    public NoticeResponse update(Long id, NoticeSaveRequest request) {
        SystemNotice notice = noticeMapper.selectById(id);
        if (notice == null) {
            throw BusinessException.notFound("公告不存在");
        }
        fillNotice(notice, request);
        noticeMapper.updateById(notice);
        auditLogService.record("公告", "更新公告", String.valueOf(id), "更新公告：" + notice.getTitle());
        return toResponse(notice);
    }

    @Transactional
    public NoticeResponse publish(Long id) {
        SystemNotice notice = noticeMapper.selectById(id);
        if (notice == null) {
            throw BusinessException.notFound("公告不存在");
        }
        notice.setPublishStatus("PUBLISHED");
        notice.setPublishedAt(LocalDateTime.now());
        noticeMapper.updateById(notice);
        auditLogService.record("公告", "发布公告", String.valueOf(id), "发布公告：" + notice.getTitle());
        return toResponse(notice);
    }

/**
 * 填充通知对象的属性方法
 * @param notice 系统通知实体对象
 * @param noticeSaveRequest 通知保存请求对象，包含需要填充的数据
 */
    private void fillNotice(SystemNotice notice, NoticeSaveRequest request) {
    // 设置通知标题，并去除前后空格
        notice.setTitle(request.getTitle().trim());
    // 设置通知内容，并去除前后空格
        notice.setContent(request.getContent().trim());
    // 设置通知类型，如果请求中未提供则默认为"INFO"
        notice.setNoticeType(StringUtils.hasText(request.getNoticeType()) ? request.getNoticeType() : "INFO");
    // 设置发布状态，如果请求中未提供则默认为"DRAFT"
        notice.setPublishStatus(StringUtils.hasText(request.getPublishStatus()) ? request.getPublishStatus() : "DRAFT");
    // 如果通知状态为已发布且发布时间为空，则设置为当前时间
        if ("PUBLISHED".equals(notice.getPublishStatus()) && notice.getPublishedAt() == null) {
            notice.setPublishedAt(LocalDateTime.now());
        }
    }

/**
 * 将系统通知实体转换为通知响应对象
 * @param notice 系统通知实体
 * @return 转换后的通知响应对象
 */
    private NoticeResponse toResponse(SystemNotice notice) {
    // 获取通知创建者信息，如果创建者为空则设为null
        SysUser creator = notice.getCreatedBy() == null ? null : userMapper.selectById(notice.getCreatedBy());
    // 构建并返回通知响应对象，包含通知的详细信息
        return new NoticeResponse(
                notice.getId(),           // 通知ID
                notice.getTitle(),        // 通知标题
                notice.getContent(),      // 通知内容
                notice.getNoticeType(),   // 通知类型
                notice.getPublishStatus(),// 发布状态
                creator == null ? "系统" : creator.getRealName(),  // 创建者名称，如果为空则显示"系统"
                notice.getPublishedAt(),  // 发布时间
                notice.getCreatedAt()     // 创建时间
        );
    }
}

