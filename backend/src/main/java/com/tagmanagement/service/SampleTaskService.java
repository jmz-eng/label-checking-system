package com.tagmanagement.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.tagmanagement.common.BusinessConstants;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.dto.BindScanRequest;
import com.tagmanagement.dto.GenerateSampleTasksRequest;
import com.tagmanagement.dto.RecordScanRequest;
import com.tagmanagement.dto.SampleTaskResponse;
import com.tagmanagement.dto.ScanResultResponse;
import com.tagmanagement.dto.VerifyScanRequest;
import com.tagmanagement.entity.AnimalInfo;
import com.tagmanagement.entity.ProjectInfo;
import com.tagmanagement.entity.SampleTask;
import com.tagmanagement.entity.ScanRecord;
import com.tagmanagement.mapper.AnimalInfoMapper;
import com.tagmanagement.mapper.ProjectInfoMapper;
import com.tagmanagement.mapper.SampleTaskMapper;
import com.tagmanagement.mapper.ScanRecordMapper;
import com.tagmanagement.security.CurrentUserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class SampleTaskService {

    private final ProjectInfoMapper projectMapper;
    private final AnimalInfoMapper animalMapper;
    private final SampleTaskMapper sampleTaskMapper;
    private final ScanRecordMapper scanRecordMapper;
    private final AuditLogService auditLogService;
    private final ProjectService projectService;

    public List<SampleTaskResponse> list(Long projectId, String status, String keyword) {
        LambdaQueryWrapper<SampleTask> wrapper = new LambdaQueryWrapper<SampleTask>()
                .orderByDesc(SampleTask::getCreatedAt);
        if (projectId != null) {
            wrapper.eq(SampleTask::getProjectId, projectId);
        }
        if (StringUtils.hasText(status)) {
            wrapper.eq(SampleTask::getStatus, status);
        }
        List<SampleTaskResponse> responses = sampleTaskMapper.selectList(wrapper).stream()
                .map(this::toResponse)
                .toList();
        if (!StringUtils.hasText(keyword)) {
            return responses;
        }
        String lowerKeyword = keyword.trim().toLowerCase(Locale.ROOT);
        return responses.stream()
                .filter(item -> contains(item.getLabelCode(), lowerKeyword)
                        || contains(item.getAnimalNo(), lowerKeyword)
                        || contains(item.getProjectCode(), lowerKeyword)
                        || contains(item.getTimePoint(), lowerKeyword))
                .toList();
    }

    @Transactional
    public List<SampleTaskResponse> generate(GenerateSampleTasksRequest request) {
        ProjectInfo project = projectService.getById(request.getProjectId());
        List<SampleTaskResponse> responses = new ArrayList<>();
        for (GenerateSampleTasksRequest.Row row : request.getRows()) {
            AnimalInfo animal = findOrCreateAnimal(project.getId(), row);
            SampleTask task = new SampleTask();
            task.setProjectId(project.getId());
            task.setAnimalId(animal.getId());
            task.setLabelCode(generateLabelCode(project, row));
            task.setTubeNo(trimToNull(row.getTubeNo()));
            task.setSampleType(row.getSampleType().trim());
            task.setTimePoint(row.getTimePoint().trim());
            task.setPlannedCollectDate(row.getPlannedCollectDate());
            task.setStatus(BusinessConstants.TASK_PRINTED);
            sampleTaskMapper.insert(task);
            responses.add(toResponse(task));
        }
        auditLogService.record("采样任务", "生成标签", project.getProjectCode(), "生成采样任务 " + responses.size() + " 条");
        return responses;
    }

    @Transactional
    public ScanResultResponse bind(BindScanRequest request) {
        SampleTask task = findTaskForScan(request.getLabelCode(), BusinessConstants.SCAN_BIND);
        AnimalInfo animal = animalMapper.selectById(task.getAnimalId());
        String expected = expectedSummary(task);
        String payload = "animalNo=" + request.getAnimalNo();

        if (!same(animal.getAnimalNo(), request.getAnimalNo())) {
            String message = "动物号不一致，期望 " + animal.getAnimalNo() + "，实际 " + request.getAnimalNo();
            recordScan(task, BusinessConstants.SCAN_BIND, expected, payload, BusinessConstants.RESULT_FAIL, message);
            return new ScanResultResponse(false, message, task.getStatus(), toResponse(task));
        }
        if (BusinessConstants.TASK_VOIDED.equals(task.getStatus())) {
            throw BusinessException.conflict("标签已作废，不能绑定");
        }
        if (BusinessConstants.TASK_RECORDED.equals(task.getStatus())) {
            throw BusinessException.conflict("样本已录入，不能重新绑定");
        }
        if (BusinessConstants.TASK_PRINTED.equals(task.getStatus())) {
            task.setStatus(BusinessConstants.TASK_BOUND);
            task.setBoundBy(CurrentUserContext.get().getId());
            task.setBoundAt(LocalDateTime.now());
            sampleTaskMapper.updateById(task);
        }
        String message = "绑定成功，标签与动物号一致";
        recordScan(task, BusinessConstants.SCAN_BIND, expected, payload, BusinessConstants.RESULT_PASS, message);
        auditLogService.record("扫码", "贴标绑定", task.getLabelCode(), message);
        return new ScanResultResponse(true, message, task.getStatus(), toResponse(task));
    }

    @Transactional
    public ScanResultResponse verify(VerifyScanRequest request) {
        SampleTask task = findTaskForScan(request.getLabelCode(), BusinessConstants.SCAN_VERIFY);
        ProjectInfo project = projectMapper.selectById(task.getProjectId());
        AnimalInfo animal = animalMapper.selectById(task.getAnimalId());
        String expected = expectedSummary(task);
        String payload = "projectCode=" + request.getProjectCode()
                + ", animalNo=" + request.getAnimalNo()
                + ", timePoint=" + request.getTimePoint();

        if (BusinessConstants.TASK_VOIDED.equals(task.getStatus())) {
            throw BusinessException.conflict("标签已作废，不能核对");
        }

        List<String> errors = new ArrayList<>();
        if (!same(project.getProjectCode(), request.getProjectCode())) {
            errors.add("项目号不一致，期望 " + project.getProjectCode() + "，实际 " + request.getProjectCode());
        }
        if (!same(animal.getAnimalNo(), request.getAnimalNo())) {
            errors.add("动物号不一致，期望 " + animal.getAnimalNo() + "，实际 " + request.getAnimalNo());
        }
        if (!same(task.getTimePoint(), request.getTimePoint())) {
            errors.add("时间点不一致，期望 " + task.getTimePoint() + "，实际 " + request.getTimePoint());
        }
        if (!errors.isEmpty()) {
            String message = String.join("；", errors);
            recordScan(task, BusinessConstants.SCAN_VERIFY, expected, payload, BusinessConstants.RESULT_FAIL, message);
            return new ScanResultResponse(false, message, task.getStatus(), toResponse(task));
        }

        if (!BusinessConstants.TASK_RECORDED.equals(task.getStatus())) {
            task.setStatus(BusinessConstants.TASK_VERIFIED);
            task.setVerifiedBy(CurrentUserContext.get().getId());
            task.setVerifiedAt(LocalDateTime.now());
            sampleTaskMapper.updateById(task);
        }
        String message = "核对通过，可以继续操作";
        recordScan(task, BusinessConstants.SCAN_VERIFY, expected, payload, BusinessConstants.RESULT_PASS, message);
        auditLogService.record("扫码", "操作核对", task.getLabelCode(), message);
        return new ScanResultResponse(true, message, task.getStatus(), toResponse(task));
    }

    @Transactional
    public ScanResultResponse record(RecordScanRequest request) {
        SampleTask task = findTaskForScan(request.getLabelCode(), BusinessConstants.SCAN_RECORD);
        if (BusinessConstants.TASK_VOIDED.equals(task.getStatus())) {
            throw BusinessException.conflict("标签已作废，不能录入");
        }
        if (BusinessConstants.TASK_PRINTED.equals(task.getStatus())) {
            throw BusinessException.conflict("样本还未完成贴标绑定，不能录入");
        }
        task.setStatus(BusinessConstants.TASK_RECORDED);
        task.setRecordedBy(CurrentUserContext.get().getId());
        task.setRecordedAt(LocalDateTime.now());
        sampleTaskMapper.updateById(task);

        String message = "录入确认完成";
        String payload = "resultNote=" + (StringUtils.hasText(request.getResultNote()) ? request.getResultNote() : "");
        recordScan(task, BusinessConstants.SCAN_RECORD, expectedSummary(task), payload, BusinessConstants.RESULT_PASS, message);
        auditLogService.record("扫码", "录入确认", task.getLabelCode(), message);
        return new ScanResultResponse(true, message, task.getStatus(), toResponse(task));
    }

    public SampleTaskResponse toResponse(SampleTask task) {
        ProjectInfo project = projectMapper.selectById(task.getProjectId());
        AnimalInfo animal = animalMapper.selectById(task.getAnimalId());
        return new SampleTaskResponse(
                task.getId(),
                task.getProjectId(),
                project == null ? "" : project.getProjectCode(),
                project == null ? "" : project.getProjectName(),
                project == null ? "" : project.getTestArticle(),
                animal == null ? "" : animal.getAnimalNo(),
                animal == null ? "" : animal.getGroupNo(),
                animal == null ? "" : animal.getGender(),
                task.getLabelCode(),
                task.getTubeNo(),
                task.getSampleType(),
                task.getTimePoint(),
                task.getPlannedCollectDate(),
                task.getStatus(),
                task.getCreatedAt()
        );
    }

    private AnimalInfo findOrCreateAnimal(Long projectId, GenerateSampleTasksRequest.Row row) {
        AnimalInfo animal = animalMapper.selectOne(new LambdaQueryWrapper<AnimalInfo>()
                .eq(AnimalInfo::getProjectId, projectId)
                .eq(AnimalInfo::getAnimalNo, row.getAnimalNo().trim()));
        if (animal != null) {
            return animal;
        }
        animal = new AnimalInfo();
        animal.setProjectId(projectId);
        animal.setAnimalNo(row.getAnimalNo().trim());
        animal.setGroupNo(trimToNull(row.getGroupNo()));
        animal.setGender(trimToNull(row.getGender()));
        animal.setStatus(BusinessConstants.STATUS_ACTIVE);
        animalMapper.insert(animal);
        return animal;
    }

    private String generateLabelCode(ProjectInfo project, GenerateSampleTasksRequest.Row row) {
        long count = sampleTaskMapper.selectCount(new LambdaQueryWrapper<SampleTask>()
                .eq(SampleTask::getProjectId, project.getId()));
        int sequence = (int) count + 1;
        String prefix = "TM-" + normalize(project.getProjectCode())
                + "-" + normalize(row.getAnimalNo())
                + "-" + normalize(row.getTimePoint());
        String labelCode;
        do {
            labelCode = prefix + "-" + String.format("%04d", sequence++);
        } while (sampleTaskMapper.selectOne(new LambdaQueryWrapper<SampleTask>()
                .eq(SampleTask::getLabelCode, labelCode)) != null);
        return labelCode;
    }

    private SampleTask findTaskForScan(String labelCode, String actionType) {
        String code = labelCode.trim();
        SampleTask task = sampleTaskMapper.selectOne(new LambdaQueryWrapper<SampleTask>()
                .eq(SampleTask::getLabelCode, code));
        if (task == null) {
            ScanRecord record = new ScanRecord();
            record.setLabelCode(code);
            record.setActionType(actionType);
            record.setExpectedSummary("-");
            record.setScannedPayload("labelCode=" + code);
            record.setResult(BusinessConstants.RESULT_FAIL);
            record.setMessage("标签码不存在");
            record.setOperatorId(CurrentUserContext.getUserIdOrNull());
            scanRecordMapper.insert(record);
            throw BusinessException.notFound("标签码不存在，请检查是否扫错标签");
        }
        return task;
    }

    private void recordScan(
            SampleTask task,
            String actionType,
            String expected,
            String payload,
            String result,
            String message
    ) {
        ScanRecord record = new ScanRecord();
        record.setTaskId(task.getId());
        record.setLabelCode(task.getLabelCode());
        record.setActionType(actionType);
        record.setExpectedSummary(expected);
        record.setScannedPayload(payload);
        record.setResult(result);
        record.setMessage(message);
        record.setOperatorId(CurrentUserContext.getUserIdOrNull());
        scanRecordMapper.insert(record);
    }

    private String expectedSummary(SampleTask task) {
        ProjectInfo project = projectMapper.selectById(task.getProjectId());
        AnimalInfo animal = animalMapper.selectById(task.getAnimalId());
        return "projectCode=" + (project == null ? "" : project.getProjectCode())
                + ", animalNo=" + (animal == null ? "" : animal.getAnimalNo())
                + ", timePoint=" + task.getTimePoint()
                + ", collectDate=" + task.getPlannedCollectDate();
    }

    private boolean same(String expected, String actual) {
        return Objects.equals(
                expected == null ? "" : expected.trim().toLowerCase(Locale.ROOT),
                actual == null ? "" : actual.trim().toLowerCase(Locale.ROOT)
        );
    }

    private boolean contains(String source, String lowerKeyword) {
        return source != null && source.toLowerCase(Locale.ROOT).contains(lowerKeyword);
    }

    private String normalize(String value) {
        return value == null
                ? ""
                : value.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}

