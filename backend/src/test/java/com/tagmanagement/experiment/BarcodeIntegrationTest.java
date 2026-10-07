package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

class BarcodeIntegrationTest extends ExperimentTestSupport {
    @org.springframework.beans.factory.annotation.Autowired
    com.tagmanagement.barcode.BarcodeRegistry registry;

    @org.springframework.beans.factory.annotation.Autowired
    org.springframework.transaction.PlatformTransactionManager manager;

    @org.springframework.beans.factory.annotation.Autowired
    com.tagmanagement.barcode.BarcodeBackfill backfill;

    @Test
    void twentyOuterTransactionsAllocateWithoutStarvingPoolAndNamespacesAreGlobal()
            throws Exception {
        var pool = Executors.newFixedThreadPool(20);
        String entity = "concurrent-" + UUID.randomUUID();
        try {
            var jobs = new ArrayList<Future<String>>();
            for (int i = 0; i < 20; i++)
                jobs.add(
                        pool.submit(
                                () ->
                                        new org.springframework.transaction.support
                                                        .TransactionTemplate(manager)
                                                .execute(
                                                        status -> {
                                                            jdbc.queryForObject(
                                                                    "SELECT COUNT(*) FROM"
                                                                        + " label_barcode",
                                                                    Long.class);
                                                            return registry.allocate(
                                                                    "TUBE", entity);
                                                        })));
            var same = new HashSet<String>();
            for (var job : jobs) same.add(job.get(15, TimeUnit.SECONDS));
            assertEquals(1, same.size());
            var distinct = new HashSet<String>();
            jobs.clear();
            for (int i = 0; i < 40; i++) {
                String id = "distinct-" + i + UUID.randomUUID();
                jobs.add(pool.submit(() -> registry.allocate("TUBE", id)));
            }
            for (var job : jobs) distinct.add(job.get(15, TimeUnit.SECONDS));
            assertEquals(40, distinct.size());
            assertNotEquals(same.iterator().next(), registry.allocate("SAMPLE_TASK", entity));
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void startupBackfillPreservesLegacyTubePayloadAndHistories() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        String id = c.path("id").asText();
        String before =
                jdbc.queryForObject("SELECT payload FROM exp_tube WHERE id=?", String.class, id);
        var histories =
                jdbc.queryForList(
                        "SELECT payload FROM exp_event WHERE project_id=? ORDER BY id",
                        String.class,
                        Long.valueOf(p));
        jdbc.update("DELETE FROM label_barcode WHERE namespace='TUBE' AND entity_id=?", id);
        backfill.run(new org.springframework.boot.DefaultApplicationArguments());
        assertEquals(
                before,
                jdbc.queryForObject("SELECT payload FROM exp_tube WHERE id=?", String.class, id));
        assertEquals(
                histories,
                jdbc.queryForList(
                        "SELECT payload FROM exp_event WHERE project_id=? ORDER BY id",
                        String.class,
                        Long.valueOf(p)));
        assertTrue(read("/" + p + "/tubes/" + id).path("barcode").asText().matches("[0-9]{12}"));
    }

    @Test
    void aliasesStableDistinctPrintAndReplacement() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        var a = tube(p, u, "ALIQUOT", c.path("id").asText(), "2026-10-05");
        assertTrue(c.path("barcode").asText().matches("[0-9]{12}"));
        assertNotEquals(c.path("barcode"), a.path("barcode"));
        assertEquals(
                c.path("barcode"),
                read("/" + p + "/tubes/" + c.path("id").asText()).path("barcode"));
        for (int i = 0; i < 2; i++) {
            var printed =
                    call(
                            "/" + p + "/print-requests",
                            Map.of("tubeIds", List.of(c.path("id").asText())));
            assertEquals(c.path("barcode"), printed.path("tubes").get(0).path("barcode"));
        }
        var changed =
                call(
                        "/" + p + "/tubes/" + c.path("id").asText(),
                        Map.of("labelInfo", "更正", "reason", "更正"));
        assertNotEquals(c.path("barcode"), changed.path("barcode"));
        assertEquals(
                "VOID", read("/" + p + "/tubes/" + c.path("id").asText()).path("status").asText());
    }

    @Test
    void oldAndNewScansShareValidation() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        var a = tube(p, u, "ALIQUOT", c.path("id").asText(), "2026-10-05");
        assertTrue(c.path("barcode").asText().matches("[0-9]{12}"));
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        assertEquals(
                "PASSED",
                call("/sessions/" + s + "/tube", Map.of("content", c.path("barcode").asText()))
                        .path("state")
                        .asText());
        s = start(p, u, "ALIQUOT").path("id").asText();
        call("/sessions/" + s + "/tube", Map.of("content", c.path("code").asText()));
        assertEquals(
                "PASSED",
                call("/sessions/" + s + "/tube", Map.of("content", a.path("barcode").asText()))
                        .path("state")
                        .asText());
        call("/" + p + "/tubes/" + c.path("id").asText() + "/void", Map.of("reason", "作废"));
        s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        for (String code : List.of(c.path("code").asText(), c.path("barcode").asText()))
            assertEquals(
                    "FAILED",
                    call("/sessions/" + s + "/tube", Map.of("content", code))
                            .path("state")
                            .asText());
    }

    @Test
    void existingTubeConcurrentAllocationLeavesPayloadUntouched() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        String id = c.path("id").asText();
        var payload =
                json.readTree(
                        jdbc.queryForObject(
                                "SELECT payload FROM exp_tube WHERE id=?", String.class, id));
        ((com.fasterxml.jackson.databind.node.ObjectNode) payload).remove("barcode");
        jdbc.update(
                "UPDATE exp_tube SET payload=? WHERE id=?", json.writeValueAsString(payload), id);
        String before =
                jdbc.queryForObject("SELECT payload FROM exp_tube WHERE id=?", String.class, id);

        var pool = Executors.newFixedThreadPool(8);
        try {
            var jobs = new ArrayList<Future<String>>();
            for (int i = 0; i < 16; i++)
                jobs.add(
                        pool.submit(() -> read("/" + p + "/tubes/" + id).path("barcode").asText()));
            var aliases = new HashSet<String>();
            for (var job : jobs) aliases.add(job.get(15, TimeUnit.SECONDS));
            assertEquals(1, aliases.size());
            assertTrue(aliases.iterator().next().matches("[0-9]{12}"));
        } finally {
            pool.shutdownNow();
        }
        assertEquals(
                before,
                jdbc.queryForObject("SELECT payload FROM exp_tube WHERE id=?", String.class, id));
    }
}
