package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.*;

class ExperimentImportTest extends ExperimentTestSupport {

    @Test
    void realExcelGroupPreviewCommitOriginalAndDuplicate() throws Exception {
        String p = project(), code = read("/" + p).path("projectCode").asText();
        byte[] bytes =
                excel(
                        new String[] {"试验编号", "动物号", "芯片号"},
                        new String[] {code, "0001", "000000012345"});
        var preview =
                json.readTree(
                                mvc.perform(
                                                multipart(
                                                                "/api/experiments/"
                                                                        + p
                                                                        + "/imports/preview")
                                                        .file(
                                                                new MockMultipartFile(
                                                                        "file",
                                                                        "group.xlsx",
                                                                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                                                        bytes))
                                                        .param("kind", "GROUP")
                                                        .param(
                                                                "requestId",
                                                                UUID.randomUUID().toString())
                                                        .header("Authorization", "Bearer " + token))
                                        .andExpect(status().isOk())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .path("data");
        assertEquals(0, preview.path("issues").size());
        String id = preview.path("id").asText();
        assertEquals("0001", preview.path("rows").get(0).path("animalNo").asText());
        call(
                "/" + p + "/imports/" + id + "/commit",
                Map.of("confirmed", true, "acknowledgeDuplicate", false));
        assertEquals("000000012345", read("/" + p + "/mappings").get(0).path("chipNo").asText());
        byte[] original =
                mvc.perform(
                                get("/api/experiments/" + p + "/imports/" + id + "/original")
                                        .header("Authorization", "Bearer " + token))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsByteArray();
        assertArrayEquals(bytes, original);
    }

    @Test
    void invalidSheetReportsCellAndPreservesOriginal() throws Exception {
        String p = project();
        byte[] bytes =
                excel(
                        new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
                        new String[] {"WRONG", "missing", "1h", "血浆", "2026-02-30"});
        var result =
                json.readTree(
                                mvc.perform(
                                                multipart(
                                                                "/api/experiments/"
                                                                        + p
                                                                        + "/imports/preview")
                                                        .file(
                                                                new MockMultipartFile(
                                                                        "file",
                                                                        "bad.xlsx",
                                                                        "application/octet-stream",
                                                                        bytes))
                                                        .param("kind", "COLLECTION")
                                                        .param(
                                                                "requestId",
                                                                UUID.randomUUID().toString())
                                                        .header("Authorization", "Bearer " + token))
                                        .andExpect(status().isOk())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString())
                        .path("data");
        assertTrue(result.path("issues").size() >= 3);
        assertEquals("样表", result.path("issues").get(0).path("sheet").asText());
        assertEquals(2, result.path("issues").get(0).path("row").asInt());
    }

    @Test
    void uncertainPurposeAndDuplicateTubeFileNeedExplicitConfirmation() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        String code = read("/" + p).path("projectCode").asText();
        byte[] bytes =
                excel(
                        new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
                        new String[] {code, "001", "1h", "无法猜测的用途", "2026-10-05"});
        String id = upload(p, bytes, "COLLECTION").path("id").asText();
        var rejected = call("/" + p + "/imports/" + id + "/commit", Map.of("confirmed", true));
        assertEquals("REJECTED", rejected.path("status").asText());
        assertEquals(0, read("/" + p + "/tubes").size());
        var assignments = List.of(Map.of("rowKey", "样表:2", "purposeId", u));
        assertEquals(
                "COMMITTED",
                call(
                                "/" + p + "/imports/" + id + "/commit",
                                Map.of("confirmed", true, "assignments", assignments))
                        .path("status")
                        .asText());
        var duplicate = upload(p, bytes, "COLLECTION");
        assertTrue(duplicate.path("duplicate").asBoolean());
        String dup = duplicate.path("id").asText();
        mvc.perform(
                        post("/api/experiments/" + p + "/imports/" + dup + "/commit")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        json.writeValueAsBytes(
                                                Map.of(
                                                        "requestId",
                                                        UUID.randomUUID().toString(),
                                                        "confirmed",
                                                        true,
                                                        "assignments",
                                                        assignments))))
                .andExpect(status().isConflict());
        assertEquals(
                "COMMITTED",
                call(
                                "/" + p + "/imports/" + dup + "/commit",
                                Map.of(
                                        "confirmed",
                                        true,
                                        "acknowledgeDuplicate",
                                        true,
                                        "assignments",
                                        assignments))
                        .path("status")
                        .asText());
        assertEquals(2, read("/" + p + "/tubes").size());
    }
}
