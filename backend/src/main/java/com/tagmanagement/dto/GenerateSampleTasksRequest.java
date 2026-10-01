package com.tagmanagement.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class GenerateSampleTasksRequest {

    @NotNull(message = "请选择项目")
    private Long projectId;

    @Valid
    @NotEmpty(message = "请至少录入一条采样任务")
    private List<Row> rows;

    @Data
    public static class Row {

        @jakarta.validation.constraints.NotBlank(message = "请输入动物号")
        private String animalNo;

        private String groupNo;
        private String gender;

        @jakarta.validation.constraints.NotBlank(message = "请输入样本类型")
        private String sampleType;

        @jakarta.validation.constraints.NotBlank(message = "请输入时间点")
        private String timePoint;

        @NotNull(message = "请选择计划采集日期")
        private LocalDate plannedCollectDate;

        private String tubeNo;
    }
}

