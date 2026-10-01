package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.dto.ScanRecordResponse;
import com.tagmanagement.entity.ScanRecord;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.mapper.ScanRecordMapper;
import com.tagmanagement.mapper.SysUserMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TraceService {

    private final ScanRecordMapper scanRecordMapper;
    private final SysUserMapper userMapper;

    public List<ScanRecordResponse> listScanRecords(String labelCode) {
        LambdaQueryWrapper<ScanRecord> wrapper = new LambdaQueryWrapper<ScanRecord>()
                .orderByDesc(ScanRecord::getCreatedAt);
        if (StringUtils.hasText(labelCode)) {
            wrapper.like(ScanRecord::getLabelCode, labelCode.trim());
        }
        return scanRecordMapper.selectList(wrapper).stream()
                .map(this::toResponse)
                .toList();
    }

    private ScanRecordResponse toResponse(ScanRecord record) {
        SysUser user = record.getOperatorId() == null ? null : userMapper.selectById(record.getOperatorId());
        return new ScanRecordResponse(
                record.getId(),
                record.getLabelCode(),
                record.getActionType(),
                record.getExpectedSummary(),
                record.getScannedPayload(),
                record.getResult(),
                record.getMessage(),
                user == null ? "系统" : user.getRealName(),
                record.getCreatedAt()
        );
    }
}

