package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.*;

import java.util.*;

class LegacyRegressionTest extends ExperimentTestSupport {
    String fixture(String status) {
        String code = "LEG" + UUID.randomUUID();
        jdbc.update(
                "INSERT INTO project_info(project_code,project_name,test_article,status) VALUES"
                        + " (?,'legacy','','ACTIVE')",
                code);
        long p =
                jdbc.queryForObject(
                        "SELECT id FROM project_info WHERE project_code=?", Long.class, code);
        jdbc.update(
                "INSERT INTO animal_info(project_id,animal_no,status) VALUES (?,'001','ACTIVE')",
                p);
        long a =
                jdbc.queryForObject("SELECT id FROM animal_info WHERE project_id=?", Long.class, p);
        jdbc.update(
                "INSERT INTO"
                    + " sample_task(project_id,animal_id,label_code,sample_type,time_point,planned_collect_date,status)"
                    + " VALUES (?, ?,?,'blood','1h','2026-10-05',?)",
                p,
                a,
                code,
                status);
        return code;
    }

    @Test
    void verifyCannotSkipBound() throws Exception {
        String code = fixture("PRINTED");
        mvc.perform(
                        post("/api/scan/verify")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        json.writeValueAsBytes(
                                                Map.of(
                                                        "labelCode",
                                                        code,
                                                        "projectCode",
                                                        code,
                                                        "animalNo",
                                                        "001",
                                                        "timePoint",
                                                        "1h"))))
                .andExpect(status().isConflict());
        assertEquals(
                "PRINTED",
                jdbc.queryForObject(
                        "SELECT status FROM sample_task WHERE label_code=?", String.class, code));
    }

    @Test
    void recordCannotSkipVerified() throws Exception {
        String code = fixture("BOUND");
        mvc.perform(
                        post("/api/scan/record")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(json.writeValueAsBytes(Map.of("labelCode", code))))
                .andExpect(status().isConflict());
    }

    @Test
    void repeatedRecordPreservesOriginalActorAndTime() throws Exception {
        String code = fixture("RECORDED");
        jdbc.update(
                "UPDATE sample_task SET recorded_by=42,recorded_at='2020-01-01 00:00:00' WHERE"
                        + " label_code=?",
                code);
        mvc.perform(
                        post("/api/scan/record")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(json.writeValueAsBytes(Map.of("labelCode", code))))
                .andExpect(status().isOk());
        assertEquals(
                42,
                jdbc.queryForObject(
                        "SELECT recorded_by FROM sample_task WHERE label_code=?",
                        Long.class,
                        code));
        assertTrue(
                jdbc.queryForObject(
                                "SELECT recorded_at FROM sample_task WHERE label_code=?",
                                String.class,
                                code)
                        .startsWith("2020-01-01"));
    }

    @Test
    void unknownCodeFailureSurvivesTransaction() throws Exception {
        String code = "UNKNOWN" + UUID.randomUUID();
        mvc.perform(
                post("/api/scan/record")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(json.writeValueAsBytes(Map.of("labelCode", code))));
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM scan_record WHERE label_code=? AND result='FAIL'",
                        Integer.class,
                        code));
    }
}
