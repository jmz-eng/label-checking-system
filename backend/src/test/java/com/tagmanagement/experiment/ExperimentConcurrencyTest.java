package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;

class ExperimentConcurrencyTest extends ExperimentTestSupport {
    @Test
    void simultaneousSameRequestAppendsOneEvent() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var t = tube(p, u, "COLLECTION", null, "2026-10-05");
        String s = start(p, u, "COLLECTION").path("id").asText();
        call("/sessions/" + s + "/chip", Map.of("content", "000123"));
        int before = read("/" + p + "/records").size();
        var b =
                Map.<String, Object>of(
                        "requestId", "concurrent-" + s, "content", t.path("code").asText());
        var barrier = new CyclicBarrier(2);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<com.fasterxml.jackson.databind.JsonNode> task =
                    () -> {
                        barrier.await(5, TimeUnit.SECONDS);
                        return call("/sessions/" + s + "/tube", b);
                    };
            var a = pool.submit(task);
            var c = pool.submit(task);
            assertEquals(a.get(10, TimeUnit.SECONDS), c.get(10, TimeUnit.SECONDS));
            assertEquals(before + 1, read("/" + p + "/records").size());
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void crossSourceAliquotRejectedEvenWhenBothParentsHavePassed() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var first = tube(p, u, "COLLECTION", null, "2026-10-05");
        var second = tube(p, u, "COLLECTION", null, "2026-10-05");
        for (var source : List.of(first, second)) {
            String s = start(p, u, "COLLECTION").path("id").asText();
            call("/sessions/" + s + "/chip", Map.of("content", "000123"));
            call("/sessions/" + s + "/tube", Map.of("content", source.path("code").asText()));
        }
        var a = tube(p, u, "ALIQUOT", first.path("id").asText(), "2026-10-05");
        String s = start(p, u, "ALIQUOT").path("id").asText();
        call("/sessions/" + s + "/tube", Map.of("content", second.path("code").asText()));
        assertEquals(
                "FAILED",
                call("/sessions/" + s + "/tube", Map.of("content", a.path("code").asText()))
                        .path("state")
                        .asText());
        call("/sessions/" + s + "/exception-close", Map.of("remark", "来源管不同", "confirmed", true));
    }
}
