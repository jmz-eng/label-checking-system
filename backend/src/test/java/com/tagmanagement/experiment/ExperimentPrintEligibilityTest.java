package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.*;

class ExperimentPrintEligibilityTest extends ExperimentTestSupport {
    @Autowired ExperimentRepository repository;

    @Test
    void expiredSourceRejectsAliquotPrintWithoutAnySideEffects() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var source = tube(p, u, "COLLECTION", null, "2026-10-05");
        var target = tube(p, u, "ALIQUOT", source.path("id").asText(), "2026-10-05");
        // Model expiry after pairing while preserving the immutable source identity.
        var expired = repository.get("tube", source.path("id").asText());
        expired.put("expiresAt", "2020-01-01T00:00:00Z");
        repository.save("tube", expired);
        var targetBefore = repository.get("tube", target.path("id").asText());
        var eventsBefore = repository.list("event", Long.parseLong(p));
        String requestId = UUID.randomUUID().toString();
        mvc.perform(post("/api/experiments/" + p + "/print-requests")
                        .header("Authorization", "Bearer " + token)
                        .contentType("application/json")
                        .content(json.writeValueAsBytes(Map.of(
                                "requestId", requestId,
                                "tubeIds", List.of(target.path("id").asText())))))
                .andExpect(status().isConflict());
        assertEquals(targetBefore, repository.get("tube", target.path("id").asText()));
        assertEquals(expired, repository.get("tube", source.path("id").asText()));
        assertTrue(read("/" + p + "/print-requests").isEmpty());
        assertEquals(eventsBefore, repository.list("event", Long.parseLong(p)));
        assertEquals(0, jdbc.queryForObject(
                "SELECT COUNT(*) FROM exp_request WHERE actor_id=? AND request_id=?",
                Integer.class, 991L, requestId));
    }

    @Test
    void validSourceAllowsAliquotPrintWithStoredAcknowledgementAndSingleEvent() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var source = tube(p, u, "COLLECTION", null, "2026-10-05");
        var valid = repository.get("tube", source.path("id").asText());
        valid.put("expiresAt", "2099-01-01T00:00:00Z");
        repository.save("tube", valid);
        var target = tube(p, u, "ALIQUOT", source.path("id").asText(), "2026-10-05");
        int eventsBefore = repository.list("event", Long.parseLong(p)).size();
        String requestId = UUID.randomUUID().toString();
        var body = Map.<String, Object>of(
                "requestId", requestId, "tubeIds", List.of(target.path("id").asText()));
        var printed = call("/" + p + "/print-requests", body);
        assertEquals("REQUEST_ACKNOWLEDGED", printed.path("status").asText());
        assertEquals(target.path("id"), printed.path("tubes").get(0).path("id"));
        assertEquals(source.path("id"), printed.path("tubes").get(0).path("sourceTubeId"));
        assertTrue(read("/" + p + "/tubes/" + target.path("id").asText()).path("printed").asBoolean());
        assertEquals(valid, repository.get("tube", source.path("id").asText()));
        assertEquals(1, read("/" + p + "/print-requests").size());
        assertEquals(eventsBefore + 1, repository.list("event", Long.parseLong(p)).size());
        assertEquals(printed, call("/" + p + "/print-requests", body));
        assertEquals(eventsBefore + 1, repository.list("event", Long.parseLong(p)).size());
    }
}
