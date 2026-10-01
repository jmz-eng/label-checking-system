package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@TableName("animal_info")
@EqualsAndHashCode(callSuper = true)
public class AnimalInfo extends BaseTimeEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long projectId;
    private String animalNo;
    private String groupNo;
    private String gender;
    private String status;
}

