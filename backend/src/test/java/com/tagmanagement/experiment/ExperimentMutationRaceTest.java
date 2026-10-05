package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

import com.fasterxml.jackson.databind.JsonNode;

import org.junit.jupiter.api.*;
import org.springframework.boot.test.mock.mockito.SpyBean;

import java.util.*;
import java.util.concurrent.*;

class ExperimentMutationRaceTest extends ExperimentTestSupport {
    @SpyBean ExperimentRepository repository;

    String secondToken() {
        jdbc.update(
                "MERGE INTO sys_user(id,username,password_hash,real_name,status) KEY(id)"
                        + " VALUES(993,'race','unused','并发员','ENABLED')");
        jdbc.update("MERGE INTO sys_user_role(id,user_id,role_id) KEY(id) VALUES(993,993,991)");
        var u = new com.tagmanagement.entity.SysUser();
        u.setId(993L);
        u.setUsername("race");
        return tokens.createToken(u);
    }

    record Reply(int status, JsonNode data) {}

    Reply postAs(String auth, String path, Map<String, Object> body) throws Exception {
        var b = new HashMap<>(body);
        b.putIfAbsent("requestId", UUID.randomUUID().toString());
        var response =
                mvc.perform(
                                post("/api/experiments" + path)
                                        .header("Authorization", "Bearer " + auth)
                                        .contentType("application/json")
                                        .content(json.writeValueAsBytes(b)))
                        .andReturn()
                        .getResponse();
        return new Reply(
                response.getStatus(), json.readTree(response.getContentAsString()).path("data"));
    }

    List<Reply> race(Callable<Reply> a, Callable<Reply> b) throws Exception {
        var gate = new CyclicBarrier(2);
        var pool = Executors.newFixedThreadPool(2);
        try {
            var one =
                    pool.submit(
                            () -> {
                                gate.await(5, TimeUnit.SECONDS);
                                return a.call();
                            });
            var two =
                    pool.submit(
                            () -> {
                                gate.await(5, TimeUnit.SECONDS);
                                return b.call();
                            });
            return List.of(one.get(15, TimeUnit.SECONDS), two.get(15, TimeUnit.SECONDS));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void concurrentPreviewsRequireAcknowledgementAtCommitForBothActors() throws Exception {
        String p = project(), auth = secondToken();
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
        var previews = race(() -> previewAs(token, p, bytes), () -> previewAs(auth, p, bytes));
        assertEquals(List.of(200, 200), previews.stream().map(Reply::status).toList());
        String a = "/" + p + "/imports/" + previews.get(0).data().path("id").asText() + "/commit";
        String b = "/" + p + "/imports/" + previews.get(1).data().path("id").asText() + "/commit";
        var denied =
                race(
                        () -> postAs(token, a, Map.of("confirmed", true)),
                        () -> postAs(auth, b, Map.of("confirmed", true)));
        assertEquals(List.of(409, 409), denied.stream().map(Reply::status).toList());
        assertEquals(0, read("/" + p + "/tubes").size());
        var accepted =
                race(
                        () ->
                                postAs(
                                        token,
                                        a,
                                        Map.of("confirmed", true, "acknowledgeDuplicate", true)),
                        () ->
                                postAs(
                                        auth,
                                        b,
                                        Map.of("confirmed", true, "acknowledgeDuplicate", true)));
        assertEquals(List.of(200, 200), accepted.stream().map(Reply::status).toList());
        assertEquals(2, read("/" + p + "/tubes").size());
    }

    Reply previewAs(String auth, String p, byte[] bytes) throws Exception {
        var response =
                mvc.perform(
                                multipart("/api/experiments/" + p + "/imports/preview")
                                        .file(
                                                new org.springframework.mock.web.MockMultipartFile(
                                                        "file",
                                                        "same.xlsx",
                                                        "application/octet-stream",
                                                        bytes))
                                        .param("kind", "COLLECTION")
                                        .param("requestId", UUID.randomUUID().toString())
                                        .header("Authorization", "Bearer " + auth))
                        .andReturn()
                        .getResponse();
        return new Reply(
                response.getStatus(), json.readTree(response.getContentAsString()).path("data"));
    }

    @Test
    void twoActorsCannotCommitSameBatchTwice() throws Exception {
        String p = project(), auth = secondToken();
        purpose(p);
        mapping(p);
        var batch =
                upload(
                        p,
                        excel(
                                new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
                                new String[] {
                                    read("/" + p).path("projectCode").asText(),
                                    "001",
                                    "1h",
                                    "原血",
                                    "2026-10-05"
                                }),
                        "COLLECTION");
        String path = "/" + p + "/imports/" + batch.path("id").asText() + "/commit";
        var replies =
                race(
                        () -> postAs(token, path, Map.of("confirmed", true)),
                        () -> postAs(auth, path, Map.of("confirmed", true)));
        assertEquals(List.of(200, 409), replies.stream().map(Reply::status).sorted().toList());
        assertEquals(1, read("/" + p + "/tubes").size());
    }

    @Test
    void printBetweenCorrectionReadAndLockIsPreservedInArchive() throws Exception {
        String p = project(), u = purpose(p), auth = secondToken();
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String id = t.path("id").asText();
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        doAnswer(
                        inv -> {
                            if (Thread.currentThread().getName().equals("paused-correction")) {
                                entered.countDown();
                                assertTrue(release.await(10, TimeUnit.SECONDS));
                            }
                            return inv.callRealMethod();
                        })
                .when(repository)
                .lock("tube", id);
        var pool = Executors.newSingleThreadExecutor(r -> new Thread(r, "paused-correction"));
        try {
            var correction =
                    pool.submit(
                            () ->
                                    postAs(
                                            token,
                                            "/" + p + "/tubes/" + id,
                                            Map.of("labelInfo", "更正", "reason", "修正")));
            assertTrue(entered.await(5, TimeUnit.SECONDS));
            assertEquals(
                    200,
                    postAs(auth, "/" + p + "/print-requests", Map.of("tubeIds", List.of(id)))
                            .status());
            release.countDown();
            assertEquals(200, correction.get(10, TimeUnit.SECONDS).status());
            assertTrue(repository.get("tube", id).get("printed").equals(true));
            var events = repository.list("event", Long.parseLong(p));
            var event =
                    events.stream()
                            .filter(e -> "TUBE_REISSUE".equals(e.get("action")))
                            .findFirst()
                            .orElseThrow();
            assertEquals(true, ((Map<?, ?>) event.get("before")).get("printed"));
        } finally {
            release.countDown();
            pool.shutdownNow();
        }
    }

    @Test
    void twoActorsCorrectionAndVoidHaveSingleWinner() throws Exception {
        String p = project(), u = purpose(p), auth = secondToken();
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String path = "/" + p + "/tubes/" + t.path("id").asText();
        var replies =
                race(
                        () -> postAs(token, path, Map.of("labelInfo", "changed", "reason", "edit")),
                        () -> postAs(auth, path + "/void", Map.of("reason", "void")));
        assertEquals(List.of(200, 409), replies.stream().map(Reply::status).sorted().toList());
        assertEquals("VOID", repository.get("tube", t.path("id").asText()).get("status"));
    }

    @Test
    void twoActorsMappingEditsPreserveEveryVersionAndBeforeChain() throws Exception {
        String p = project(), auth = secondToken();
        mapping(p);
        String id = read("/" + p + "/mappings").get(0).path("id").asText();
        String path = "/" + p + "/mappings/" + id;
        var replies =
                race(
                        () ->
                                postAs(
                                        token,
                                        path,
                                        Map.of(
                                                "animalNo",
                                                "001",
                                                "chipNo",
                                                "A",
                                                "reason",
                                                "edit A")),
                        () ->
                                postAs(
                                        auth,
                                        path,
                                        Map.of(
                                                "animalNo",
                                                "001",
                                                "chipNo",
                                                "B",
                                                "reason",
                                                "edit B")));
        assertEquals(List.of(200, 200), replies.stream().map(Reply::status).toList());
        assertEquals(3, ((Number) repository.get("mapping", id).get("version")).intValue());
        var edits =
                repository.list("event", Long.parseLong(p)).stream()
                        .filter(e -> "MAPPING_EDIT".equals(e.get("action")))
                        .toList();
        assertEquals(2, edits.size());
        assertEquals(edits.get(0).get("after"), edits.get(1).get("before"));
    }

    @Test
    void sourceAndAliquotScansAndPrintUseOneTubeBeforePurposeLockOrder() throws Exception {
        String p = project(), u = purpose(p), auth = secondToken();
        mapping(p);
        var source = tube(p, u, "COLLECTION", null, "2026-10-05");
        String first = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + first + "/chip", Map.of("content", "000123"));
        call("/sessions/" + first + "/tube", Map.of("content", source.path("code").asText()));
        var aliquot = tube(p, u, "ALIQUOT", source.path("id").asText(), "2026-10-05");
        String a = start(p, u, "ALIQUOT").path("id").asText();
        call("/sessions/" + a + "/tube", Map.of("content", source.path("code").asText()));
        var other =
                postAs(
                        auth,
                        "/" + p + "/sessions",
                        Map.of(
                                "stage",
                                "COLLECTION",
                                "purposeId",
                                u,
                                "collectDate",
                                "2026-10-05",
                                "timePoint",
                                "1h"));
        String s = other.data().path("id").asText();
        postAs(auth, "/sessions/" + s + "/chip", Map.of("content", "000123"));
        Map<String, List<String>> traces = new ConcurrentHashMap<>();
        doAnswer(
                        inv -> {
                            String type = inv.getArgument(0), id = inv.getArgument(1);
                            if (type.equals("tube") || type.equals("purpose"))
                                traces.computeIfAbsent(
                                                Thread.currentThread().getName(),
                                                k -> new ArrayList<>())
                                        .add(type + ":" + id);
                            return inv.callRealMethod();
                        })
                .when(repository)
                .lock(anyString(), anyString());
        var replies =
                race(
                        () ->
                                postAs(
                                        token,
                                        "/sessions/" + a + "/tube",
                                        Map.of("content", aliquot.path("code").asText())),
                        () ->
                                postAs(
                                        auth,
                                        "/sessions/" + s + "/tube",
                                        Map.of("content", source.path("code").asText())));
        assertEquals(List.of(200, 200), replies.stream().map(Reply::status).toList());
        for (var trace : traces.values()) {
            boolean purpose = false;
            String last = "";
            for (String lock : trace) {
                if (lock.startsWith("purpose:")) purpose = true;
                else {
                    assertFalse(purpose, "tube lock after purpose: " + trace);
                    assertTrue(lock.compareTo(last) >= 0, "unsorted tubes: " + trace);
                    last = lock;
                }
            }
        }
        call("/sessions/" + a + "/next", Map.of("retainSource", true));
        replies =
                race(
                        () ->
                                postAs(
                                        token,
                                        "/sessions/" + a + "/tube",
                                        Map.of("content", aliquot.path("code").asText())),
                        () ->
                                postAs(
                                        auth,
                                        "/" + p + "/print-requests",
                                        Map.of(
                                                "tubeIds",
                                                List.of(
                                                        source.path("id").asText(),
                                                        aliquot.path("id").asText()))));
        assertEquals(List.of(200, 200), replies.stream().map(Reply::status).toList());
    }
}
