package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@TableName("project_info")
@EqualsAndHashCode(callSuper = true)
public class ProjectInfo extends BaseTimeEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private String projectCode;
    private String projectName;
    private String testArticle;
    private String sponsor;
    private Long ownerId;
    private String status;
}

