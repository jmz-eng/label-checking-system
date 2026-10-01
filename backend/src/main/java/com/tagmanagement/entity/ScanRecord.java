package com.tagmanagement.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("scan_record")
public class ScanRecord {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private String labelCode;
    private String actionType;
    private String expectedSummary;
    private String scannedPayload;
    private String result;
    private String message;
    private Long operatorId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}

