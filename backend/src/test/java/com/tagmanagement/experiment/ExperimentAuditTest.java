package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;

import java.util.Map;

class ExperimentAuditTest extends ExperimentTestSupport {
    @Test
    void changeDetailAndExportExposeImmutableMappingHistory() throws Exception {
        String p = project();
        mapping(p);
        String m = read("/" + p + "/mappings").get(0).path("id").asText();
        call(
                "/" + p + "/mappings/" + m,
                Map.of("animalNo", "001", "chipNo", "999", "reason", "更换芯片"));
        var history = read("/" + p + "/mappings/" + m + "/history");
        var edited = history.get(history.size() - 1);
        String id = edited.path("id").asText();
        var detail = read("/" + p + "/changes/" + id);
        assertEquals("000123", detail.path("before").path("chipNo").asText());
        assertEquals("999", detail.path("after").path("chipNo").asText());
        mvc.perform(
                        get("/api/experiments/" + p + "/changes/export")
                                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }
}
