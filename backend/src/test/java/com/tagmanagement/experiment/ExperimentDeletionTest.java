package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import org.junit.jupiter.api.Test;
import com.tagmanagement.entity.SysUser;

class ExperimentDeletionTest extends ExperimentTestSupport {
    void denied(String path, Map<String, Object> body, int expected) throws Exception {
        var b = new HashMap<>(body);
        b.putIfAbsent("requestId", UUID.randomUUID().toString());
        mvc.perform(post("/api/experiments" + path).header("Authorization", "Bearer " + token)
                        .contentType("application/json").content(json.writeValueAsBytes(b)))
                .andExpect(status().is(expected));
    }

    Map<String, Object> deletion(String request) {
        return Map.of("reason", "误建测试实验", "confirmed", true, "requestId", request);
    }

    @Test
    void deletionPreservesDataAndHistoryAndRestoreIsAudited() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        var mappings = read("/" + p + "/mappings");
        var tubes = read("/" + p + "/tubes");
        var archived = read("/" + p + "/changes");
        var removed = call("/" + p + "/delete", deletion("delete-" + p));
        assertEquals("DELETED", removed.path("status").asText());
        assertEquals(removed, call("/" + p + "/delete", deletion("delete-" + p)));
        assertFalse(read("").toString().contains(removed.path("projectCode").asText()));
        assertTrue(read("?deleted=true").toString().contains(removed.path("projectCode").asText()));
        assertEquals(mappings, read("/" + p + "/mappings"));
        assertEquals(tubes, read("/" + p + "/tubes"));
        var changes = read("/" + p + "/changes");
        assertEquals(archived.size() + 1, changes.size());
        for (int i = 0; i < archived.size(); i++) assertEquals(archived.get(i), changes.get(i));
        var event = changes.get(changes.size() - 1);
        assertEquals("PROJECT_DELETE", event.path("action").asText());
        assertEquals(991, event.path("actorId").asInt());
        assertEquals("误建测试实验", event.path("reason").asText());
        assertEquals("ACTIVE", event.path("before").path("status").asText());
        assertEquals("DELETED", event.path("after").path("status").asText());
        assertEquals(t.path("code").asText(), tubes.get(0).path("code").asText());
        var restored = call("/" + p + "/restore", deletion("restore-" + p));
        assertEquals("ACTIVE", restored.path("status").asText());
        assertEquals(restored, call("/" + p + "/restore", deletion("restore-" + p)));
        assertTrue(read("").toString().contains(restored.path("projectCode").asText()));
        assertEquals(archived.size() + 2, read("/" + p + "/changes").size());
        assertEquals("PROJECT_RESTORE", read("/" + p + "/changes").get(archived.size() + 1).path("action").asText());
    }

    @Test
    void nonAdminWithWildcardStillCannotDeleteRestoreOrListDeleted() throws Exception {
        String p = project();
        jdbc.update("MERGE INTO sys_user(id,username,password_hash,real_name,status) KEY(id) VALUES(995,'delete-tech','unused','技术员','ENABLED')");
        jdbc.update("MERGE INTO sys_role(id,role_code,role_name) KEY(id) VALUES(995,'DELETE_TEST_TECH','测试技术员')");
        jdbc.update("MERGE INTO sys_user_role(id,user_id,role_id) KEY(id) VALUES(995,995,995)");
        jdbc.update("MERGE INTO sys_role_permission(id,role_id,permission_id) KEY(id) VALUES(995,995,991)");
        SysUser user = new SysUser(); user.setId(995L); user.setUsername("delete-tech");
        String adminToken = token;
        token = tokens.createToken(user);
        denied("/" + p + "/delete", deletion("denied-delete-" + p), 403);
        denied("/" + p + "/restore", deletion("denied-restore-" + p), 403);
        mvc.perform(get("/api/experiments?deleted=true").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        token = adminToken;
        assertEquals("ACTIVE", read("/" + p).path("status").asText());
    }

    @Test
    void deletionRequiresReasonConfirmationAndNoUnfinishedRound() throws Exception {
        String p = project(), u = purpose(p);
        denied("/" + p + "/delete", Map.of("confirmed", true), 400);
        denied("/" + p + "/delete", Map.of("reason", "测试"), 400);
        String s = start(p, u, "COLLECTION").path("id").asText();
        denied("/" + p + "/delete", deletion("busy-" + p), 409);
        call("/sessions/" + s + "/chip", Map.of("content", "未知芯片"));
        denied("/" + p + "/delete", deletion("failed-" + p), 409);
        call("/sessions/" + s + "/exception-close", Map.of("remark", "测试结束", "confirmed", true));
        assertEquals("DELETED", call("/" + p + "/delete", deletion("ended-" + p)).path("status").asText());
    }

    @Test
    void deletedExperimentRejectsAllNewWritesAndCannotStartNextRound() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        call("/sessions/" + s + "/tube", Map.of("content", t.path("code").asText()));
        var bytes = excel(new String[]{"试验编号", "动物号", "芯片号"}, new String[]{read("/" + p).path("projectCode").asText(), "002", "456"});
        var batch = upload(p, bytes, "GROUP");
        call("/" + p + "/delete", deletion("deleted-" + p));
        denied("/" + p + "/mappings", Map.of("animalNo", "002", "chipNo", "456"), 409);
        denied("/" + p + "/purposes", Map.of("name", "新用途", "confirmed", true), 409);
        denied("/" + p + "/tubes", Map.of("kind", "COLLECTION"), 409);
        denied("/" + p + "/tube-assignments", Map.of("assignments", List.of()), 409);
        denied("/" + p + "/print-requests", Map.of("tubeIds", List.of(t.path("id").asText())), 409);
        denied("/" + p + "/imports/" + batch.path("id").asText() + "/commit", Map.of("confirmed", true), 409);
        denied("/" + p + "/sessions", Map.of("stage", "COLLECTION", "collectDate", "2026-10-05", "timePoint", "1h", "purposeId", u), 409);
        denied("/sessions/" + s + "/next", Map.of(), 409);
        mvc.perform(multipart("/api/experiments/" + p + "/imports/preview")
                        .file(new org.springframework.mock.web.MockMultipartFile("file", "test.xlsx", "application/octet-stream", bytes))
                        .param("kind", "GROUP").param("requestId", UUID.randomUUID().toString())
                        .header("Authorization", "Bearer " + token)).andExpect(status().isConflict());
        assertEquals(1, read("/" + p + "/tubes").size());
    }
}
