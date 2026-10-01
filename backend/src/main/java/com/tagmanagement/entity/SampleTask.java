package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("sample_task")
@EqualsAndHashCode(callSuper = true)
public class SampleTask extends BaseTimeEntity {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long projectId;
    private Long animalId;
    private String labelCode;
    private String tubeNo;
    private String sampleType;
    private String timePoint;
    private LocalDate plannedCollectDate;
    private String status;
    private Long boundBy;
    private LocalDateTime boundAt;
    private Long verifiedBy;
    private LocalDateTime verifiedAt;
    private Long recordedBy;
    private LocalDateTime recordedAt;
}

