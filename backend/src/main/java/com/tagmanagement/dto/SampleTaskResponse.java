package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SampleTaskResponse {

    private Long id;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String testArticle;
    private String animalNo;
    private String groupNo;
    private String gender;
    private String labelCode;
    private String tubeNo;
    private String sampleType;
    private String timePoint;
    private LocalDate plannedCollectDate;
    private String status;
    private LocalDateTime createdAt;
}

