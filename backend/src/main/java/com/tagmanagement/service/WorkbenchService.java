package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.dto.WorkbenchSummaryResponse;
import com.tagmanagement.entity.SampleTask;
import com.tagmanagement.entity.ScanRecord;
import com.tagmanagement.mapper.SampleTaskMapper;
import com.tagmanagement.mapper.ScanRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class WorkbenchService {

    private final SampleTaskMapper sampleTaskMapper;
    private final ScanRecordMapper scanRecordMapper;

/**
 * 获取工作台摘要信息的方法
 * 统计各类任务的数量和完成率，并返回一个包含这些信息的响应对象
 *
 * @return WorkbenchSummaryResponse 包含各类任务统计信息和完成率的响应对象
 */
    public WorkbenchSummaryResponse summary() {
    // 查询总任务数量
        long totalTasks = sampleTaskMapper.selectCount(null);
    // 查询已检查任务数量（操作类型为扫描验证的任务）
        long checkedTasks = scanRecordMapper.selectCount(new LambdaQueryWrapper<ScanRecord>()
                .eq(ScanRecord::getActionType, BusinessConstants.SCAN_VERIFY));
    // 查询通过的任务数量（操作类型为扫描验证且结果为通过的任务）
        long passedTasks = scanRecordMapper.selectCount(new LambdaQueryWrapper<ScanRecord>()
                .eq(ScanRecord::getActionType, BusinessConstants.SCAN_VERIFY)
                .eq(ScanRecord::getResult, BusinessConstants.RESULT_PASS));
    // 查询失败记录数量
        long failedRecords = scanRecordMapper.selectCount(new LambdaQueryWrapper<ScanRecord>()
                .eq(ScanRecord::getResult, BusinessConstants.RESULT_FAIL));
    // 查询待处理任务数量（状态为已打印或已装订的任务）
        long pendingTasks = sampleTaskMapper.selectCount(new LambdaQueryWrapper<SampleTask>()
                .in(SampleTask::getStatus, List.of(BusinessConstants.TASK_PRINTED, BusinessConstants.TASK_BOUND)));
    // 查询扫描记录总数
        long traceRecords = scanRecordMapper.selectCount(null);
    // 计算分母（总任务数，最小为1，避免除以0）
        long denominator = Math.max(totalTasks, 1);

    // 创建并返回工作台摘要响应对象，包含各类任务数量和对应的完成率
        return new WorkbenchSummaryResponse(
                totalTasks,
                checkedTasks,
                passedTasks,
                failedRecords,
                pendingTasks,
                traceRecords,
                WorkbenchSummaryResponse.rate(checkedTasks, denominator),
                WorkbenchSummaryResponse.rate(passedTasks, denominator),
                WorkbenchSummaryResponse.rate(failedRecords, denominator),
                WorkbenchSummaryResponse.rate(pendingTasks, denominator)
        );
    }
}
