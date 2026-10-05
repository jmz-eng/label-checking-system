package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;

class ExperimentReviewRegressionTest extends ExperimentTestSupport {
    @Autowired ExperimentRepository repository;

    void conflict(String path, Map<String, Object> body) throws Exception {
        var b = new HashMap<>(body);
        b.put("requestId", UUID.randomUUID().toString());
        mvc.perform(
                        post("/api/experiments" + path)
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(json.writeValueAsBytes(b)))
                .andExpect(status().isConflict());
    }

    @Test
    void abortedOldSessionCannotBypassNewFailedSession() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        String a = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + a + "/chip", Map.of("content", "bad"));
        call("/sessions/" + a + "/exception-close", Map.of("remark", "已核实异常", "confirmed", true));
        String b = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + b + "/chip", Map.of("content", "bad"));
        try {
            conflict("/sessions/" + a + "/next", Map.of());
            conflict("/sessions/" + a + "/chip", Map.of("content", "000123"));
            conflict(
                    "/" + p + "/sessions",
                    Map.of(
                            "stage",
                            "COLLECTION",
                            "collectDate",
                            "2026-10-06",
                            "timePoint",
                            "2h",
                            "purposeId",
                            u));
            assertEquals(b, read("/sessions/current").path("id").asText());
            assertEquals("SUPERSEDED", read("/sessions/" + a).path("state").asText());
            assertEquals(
                    "ABORT", read("/sessions/" + a).path("lastResult").path("result").asText());
        } finally {
            call(
                    "/sessions/" + b + "/exception-close",
                    Map.of("remark", "测试结束", "confirmed", true));
        }
    }

    @Test
    void explicitReadCommittedOverridesDatabaseDefault() throws Exception {
        assertEquals(
                org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED,
                ((ExperimentRepository)
                                org.springframework.test.util.AopTestUtils.getTargetObject(
                                        repository))
                        .tx.getIsolationLevel());
    }

    @Test
    void commitRechecksDuplicateWhenAnotherPreviewWasCreatedLater() throws Exception {
        String p = project();
        purpose(p);
        mapping(p);
        byte[] bytes =
                excel(
                        new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
                        new String[] {
                            read("/" + p).path("projectCode").asText(),
                            "001",
                            "1h",
                            "原血",
                            "2026-10-05"
                        });
        var first = upload(p, bytes, "COLLECTION");
        upload(p, bytes, "COLLECTION");
        assertFalse(first.path("duplicate").asBoolean());
        conflict(
                "/" + p + "/imports/" + first.path("id").asText() + "/commit",
                Map.of("confirmed", true));
        assertEquals(0, read("/" + p + "/tubes").size());
        var refreshed = read("/" + p + "/imports/" + first.path("id").asText());
        assertTrue(refreshed.path("duplicate").asBoolean());
        assertEquals(1, refreshed.path("duplicateBatches").size());
    }

    @Test
    void changedWorkbookWarnsAboutExistingRowAndAllowsExplicitAppend() throws Exception {
        String p = project();
        purpose(p);
        mapping(p);
        var headers = new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"};
        var values =
                new String[] {
                    read("/" + p).path("projectCode").asText(), "001", "1h", "原血", "2026-10-05"
                };
        byte[] bytes = excel(headers, values);
        var first = upload(p, bytes, "COLLECTION");
        call(
                "/" + p + "/imports/" + first.path("id").asText() + "/commit",
                Map.of("confirmed", true));
        byte[] changed;
        try (var workbook =
                        new org.apache.poi.xssf.usermodel.XSSFWorkbook(
                                new java.io.ByteArrayInputStream(bytes));
                var out = new java.io.ByteArrayOutputStream()) {
            workbook.getProperties().getCoreProperties().setTitle("重新保存的相同管子");
            workbook.write(out);
            changed = out.toByteArray();
        }
        var second = upload(p, changed, "COLLECTION");
        assertFalse(second.path("duplicate").asBoolean());
        assertEquals(1, second.path("duplicateRows").size());
        assertEquals(
                first.path("id").asText(),
                second.path("duplicateRows").get(0).path("importId").asText());
        assertFalse(second.path("duplicateRows").get(0).path("tubeId").asText().isBlank());
        String path = "/" + p + "/imports/" + second.path("id").asText() + "/commit";
        conflict(path, Map.of("confirmed", true));
        assertEquals(
                "COMMITTED",
                call(path, Map.of("confirmed", true, "acknowledgeDuplicate", true))
                        .path("status")
                        .asText());
        assertEquals(2, read("/" + p + "/tubes").size());
    }

    @Test
    void commitRevalidatesPreviouslyAcceptedFieldWithCellDiagnostics() throws Exception {
        String p = project();
        var batch =
                upload(
                        p,
                        excel(
                                new String[] {"试验编号", "动物号", "芯片号"},
                                new String[] {
                                    read("/" + p).path("projectCode").asText(), "fresh", "chip"
                                }),
                        "GROUP");
        String id = batch.path("id").asText();
        var saved = repository.get("import", id);
        @SuppressWarnings("unchecked")
        var rows = (List<Map<String, Object>>) saved.get("rows");
        rows.get(0).put("chipNo", "C".repeat(129));
        repository.save("import", saved);
        var result = call("/" + p + "/imports/" + id + "/commit", Map.of("confirmed", true));
        assertEquals("REJECTED", result.path("status").asText());
        assertEquals("芯片号", result.path("commitIssues").get(0).path("column").asText());
        assertEquals(2, result.path("commitIssues").get(0).path("row").asInt());
        assertEquals(0, read("/" + p + "/mappings").size());
    }

    @Test
    void overlongGroupAndTubeFieldsHaveCellDiagnostics() throws Exception {
        String p = project();
        mapping(p);
        String code = read("/" + p).path("projectCode").asText();
        var group =
                upload(
                        p,
                        excel(
                                new String[] {"试验编号", "动物号", "芯片号"},
                                new String[] {code, "A".repeat(65), "C".repeat(129)}),
                        "GROUP");
        assertEquals("INVALID", group.path("status").asText());
        assertTrue(group.path("issues").toString().contains("动物号"));
        assertTrue(group.path("issues").toString().contains("芯片号"));
        var tubes =
                upload(
                        p,
                        excel(
                                new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
                                new String[] {
                                    code, "001", "T".repeat(2001), "L".repeat(2001), "2026-10-05"
                                }),
                        "COLLECTION");
        assertEquals("INVALID", tubes.path("status").asText());
        assertEquals("样表", tubes.path("issues").get(0).path("sheet").asText());
        assertEquals(2, tubes.path("issues").get(0).path("row").asInt());
    }
}
