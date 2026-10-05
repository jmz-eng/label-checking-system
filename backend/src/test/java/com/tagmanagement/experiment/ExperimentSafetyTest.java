package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import java.util.*;

class ExperimentSafetyTest extends ExperimentTestSupport {
    @Test
    void changedPurposeFailureIsArchivedAndRawWhitespaceIsRetained() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String s = start(p, u, "COLLECTION").path("id").asText();
        var chip = call("/sessions/" + s + "/chip", Map.of("content", " 000123 \n"));
        assertEquals(" 000123 \n", chip.path("lastResult").path("scannedContent").asText());
        call("/" + p + "/purposes/" + u + "/delete", Map.of("reason", "暂停规则"));
        var result = call("/sessions/" + s + "/tube", Map.of("content", t.path("code").asText()));
        assertEquals("FAILED", result.path("state").asText());
        assertEquals("FAIL", read("/sessions/" + s).path("lastResult").path("result").asText());
        call("/sessions/" + s + "/exception-close", Map.of("remark", "规则停用", "confirmed", true));
    }

    @Test
    void allMismatchDimensionsVoidExpiryAndWrongTypeRemainFailed() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var good = tube(p, u, "COLLECTION", null, "2026-10-05");
        String otherPurpose = purpose(p);
        String other = project(), op = purpose(other);
        mapping(other);
        var bad = new ArrayList<com.fasterxml.jackson.databind.JsonNode>();
        bad.add(tube(p, u, "COLLECTION", null, "2026-10-06"));
        bad.add(tube(p, otherPurpose, "COLLECTION", null, "2026-10-05"));
        bad.add(tube(other, op, "COLLECTION", null, "2026-10-05"));
        bad.add(tube(p, u, "ALIQUOT", good.path("id").asText(), "2026-10-05"));
        for (var patch :
                List.of(
                        Map.<String, Object>of("timePoint", "2h"),
                        Map.<String, Object>of("expiresAt", "2020-01-01T00:00:00Z"))) {
            var original = tube(p, u, "COLLECTION", null, "2026-10-05");
            var b = new HashMap<>(patch);
            b.put("reason", "测试");
            bad.add(call("/" + p + "/tubes/" + original.path("id").asText(), b));
        }
        var voided = tube(p, u, "COLLECTION", null, "2026-10-05");
        call("/" + p + "/tubes/" + voided.path("id").asText() + "/void", Map.of("reason", "作废"));
        bad.add(voided);
        call("/" + p + "/mappings", Map.of("animalNo", "002", "chipNo", "222"));
        bad.add(
                call(
                        "/" + p + "/tubes",
                        Map.of(
                                "kind",
                                "COLLECTION",
                                "animalNo",
                                "002",
                                "timePoint",
                                "1h",
                                "collectDate",
                                "2026-10-05",
                                "labelInfo",
                                "other animal",
                                "purposeId",
                                u,
                                "confirmed",
                                true)));
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        for (var t : bad)
            assertEquals(
                    "FAILED",
                    call("/sessions/" + s + "/tube", Map.of("content", t.path("code").asText()))
                            .path("state")
                            .asText());
        assertEquals(
                "PASSED",
                call("/sessions/" + s + "/tube", Map.of("content", good.path("code").asText()))
                        .path("state")
                        .asText());
    }

    @Test
    void replayDoesNotAppendAndPayloadReuseIsRejectedAndRemarkRequired() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        String s = start(p, u, "COLLECTION").path("id").asText();
        var body =
                Map.<String, Object>of("requestId", "scan-retry-" + s, "content", "unknown-chip");
        var first = call("/sessions/" + s + "/chip", body);
        int count = read("/" + p + "/records").size();
        assertEquals(first, call("/sessions/" + s + "/chip", body));
        assertEquals(count, read("/" + p + "/records").size());
        mvc.perform(
                        post("/api/experiments/sessions/" + s + "/chip")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        json.writeValueAsBytes(
                                                Map.of(
                                                        "requestId",
                                                        body.get("requestId"),
                                                        "content",
                                                        "000123"))))
                .andExpect(status().isConflict());
        mvc.perform(
                        post("/api/experiments/sessions/" + s + "/next")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content("{\"requestId\":\"next-invalid-" + s + "\"}"))
                .andExpect(status().isConflict());
        mvc.perform(
                        post("/api/experiments/sessions/" + s + "/exception-close")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        "{\"requestId\":\"close-invalid-"
                                                + s
                                                + "\",\"confirmed\":true,\"remark\":\" \"}"))
                .andExpect(status().isBadRequest());
        call("/sessions/" + s + "/exception-close", Map.of("remark", "确认异常", "confirmed", true));
    }

    @Test
    void operatorsIndependentAndCannotAccessAnotherSession() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        String s = start(p, u, "COLLECTION").path("id").asText();
        String old = token;
        jdbc.update(
                "MERGE INTO sys_user(id,username,password_hash,real_name,status) KEY(id)"
                        + " VALUES(992,'second','unused','第二操作员','ENABLED')");
        jdbc.update("MERGE INTO sys_user_role(id,user_id,role_id) KEY(id) VALUES(992,992,991)");
        var user = new com.tagmanagement.entity.SysUser();
        user.setId(992L);
        user.setUsername("second");
        token = tokens.createToken(user);
        mvc.perform(
                        get("/api/experiments/sessions/" + s)
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
        String second = start(p, u, "COLLECTION").path("id").asText();
        assertNotEquals(s, second);
        assertEquals(second, read("/sessions/current").path("id").asText());
        token = old;
        assertEquals(s, read("/sessions/current").path("id").asText());
    }

    @Test
    void csvProtectsFormulaInputAndMenuExistsWithoutBootstrap() throws Exception {
        assertEquals(
                1,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM sys_menu WHERE menu_key='experiments' AND"
                                + " route_path='/experiments'",
                        Integer.class));
        String p = project(), u = purpose(p);
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "=DANGEROUS()"));
        String csv =
                mvc.perform(
                                get("/api/experiments/" + p + "/records/export")
                                        .header("Authorization", "Bearer " + token))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        assertTrue(csv.contains("\"'=DANGEROUS()\""));
        call("/sessions/" + s + "/exception-close", Map.of("remark", "导出测试", "confirmed", true));
    }
}
