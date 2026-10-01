package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@TableName("system_notice")
@EqualsAndHashCode(callSuper = true)
public class SystemNotice extends BaseTimeEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String content;
    private String noticeType;
    private String publishStatus;
    private LocalDateTime publishedAt;
    private Long createdBy;
}

