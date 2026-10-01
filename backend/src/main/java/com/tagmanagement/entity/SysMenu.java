package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@TableName("sys_menu")
@EqualsAndHashCode(callSuper = true)
public class SysMenu extends BaseTimeEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long parentId;
    private String menuKey;
    private String menuName;
    private String routePath;
    private String component;
    private String permissionCode;
    private String icon;
    private Integer sortOrder;
    private Boolean visible;
    private String status;
}

