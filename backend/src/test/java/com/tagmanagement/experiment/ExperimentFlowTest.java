package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import java.util.*;

class ExperimentFlowTest extends ExperimentTestSupport {
    @Test
    void collectionFailurePersistsAndCannotBeSkippedThenCorrectionPasses() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        var fail = call("/sessions/" + s + "/tube", Map.of("content", "UNKNOWN"));
        assertEquals("FAILED", fail.path("state").asText());
        assertEquals("FAILED", read("/sessions/" + s).path("state").asText());
        mvc.perform(
                        post("/api/experiments/" + p + "/sessions")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        json.writeValueAsBytes(
                                                Map.of(
                                                        "requestId",
                                                        UUID.randomUUID().toString(),
                                                        "stage",
                                                        "COLLECTION",
                                                        "collectDate",
                                                        "2026-10-05",
                                                        "timePoint",
                                                        "1h",
                                                        "purposeId",
                                                        u))))
                .andExpect(status().isConflict());
        var pass = call("/sessions/" + s + "/tube", Map.of("content", t.path("code").asText()));
        assertEquals("PASSED", pass.path("state").asText());
        assertTrue(read("/" + p + "/records").size() >= 3);
    }

    @Test
    void aliquotNeedsExactPassedSourceAndSupportsManyTargets() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        var a = tube(p, u, "ALIQUOT", c.path("id").asText(), "2026-10-05");
        String s = start(p, u, "ALIQUOT").path("id").asText();
        assertEquals(
                "FAILED",
                call("/sessions/" + s + "/tube", Map.of("content", c.path("code").asText()))
                        .path("state")
                        .asText());
        call(
                "/sessions/" + s + "/exception-close",
                Map.of("remark", "尚未采血核对，返回采血流程", "confirmed", true));
        String cs = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + cs + "/chip", Map.of("content", "000123"));
        call("/sessions/" + cs + "/tube", Map.of("content", c.path("code").asText()));
        s = start(p, u, "ALIQUOT").path("id").asText();
        call("/sessions/" + s + "/tube", Map.of("content", c.path("code").asText()));
        assertEquals(
                "PASSED",
                call("/sessions/" + s + "/tube", Map.of("content", a.path("code").asText()))
                        .path("state")
                        .asText());
        var a2 = tube(p, u, "ALIQUOT", c.path("id").asText(), "2026-10-05");
        call("/sessions/" + s + "/next", Map.of("retainSource", true));
        assertEquals(
                "PASSED",
                call("/sessions/" + s + "/tube", Map.of("content", a2.path("code").asText()))
                        .path("state")
                        .asText());
    }

    @Test
    void retryIsIdempotentAndPrintedEditReissues() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        var b =
                Map.<String, Object>of(
                        "requestId", "print" + p, "tubeIds", List.of(c.path("id").asText()));
        var first = call("/" + p + "/print-requests", b);
        assertEquals(first, call("/" + p + "/print-requests", b));
        var changed =
                call(
                        "/" + p + "/tubes/" + c.path("id").asText(),
                        Map.of("labelInfo", "更正说明", "reason", "文字更正"));
        assertNotEquals(c.path("code").asText(), changed.path("code").asText());
        assertEquals(
                "VOID", read("/" + p + "/tubes/" + c.path("id").asText()).path("status").asText());
    }

    @Test
    void mappingEditInvalidatesInFlightChipAndExceptionNeverPasses() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        String m = read("/" + p + "/mappings").get(0).path("id").asText();
        call(
                "/" + p + "/mappings/" + m,
                Map.of("animalNo", "001", "chipNo", "000999", "reason", "更换芯片"));
        assertEquals(
                "FAILED",
                call("/sessions/" + s + "/tube", Map.of("content", c.path("code").asText()))
                        .path("state")
                        .asText());
        var closed =
                call(
                        "/sessions/" + s + "/exception-close",
                        Map.of("remark", "确认更换后重扫", "confirmed", true));
        assertEquals("ABORTED", closed.path("state").asText());
        assertEquals("ABORT", closed.path("lastResult").path("result").asText());
    }
}
