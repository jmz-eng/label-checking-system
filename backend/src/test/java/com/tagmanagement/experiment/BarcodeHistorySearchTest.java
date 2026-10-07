package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.tagmanagement.barcode.BarcodeRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.nio.charset.StandardCharsets;
import java.util.*;

class BarcodeHistorySearchTest extends ExperimentTestSupport {
    @Autowired ExperimentRepository repository;
    @Autowired BarcodeRegistry registry;

    @Test
    void recordsAliasIncludesOldAndNewIdentityReferencesWithoutChangingArchiveBytes() throws Exception {
        var fixture = history();
        assertEquals(fixture.records(), ids(read("/" + fixture.project() + "/records?keyword=" + fixture.alias())));
        assertEquals(fixture.before(), archives(fixture.project()));
        var originalMatches = new HashSet<String>();
        fixture.before().forEach((id, payload) -> {
            if (payload.contains(fixture.code())) originalMatches.add(id);
        });
        assertEquals(originalMatches, ids(read("/" + fixture.project() + "/records?keyword=" + fixture.code())));
        assertTrue(read("/" + fixture.otherProject() + "/records?keyword=" + fixture.alias()).isEmpty());
    }

    @Test
    void aliasChangesAndCsvExportsPreserveProjectAndOtherFilters() throws Exception {
        var fixture = history();
        String base = "/" + fixture.project();
        String query = "?keyword=" + fixture.alias();
        assertEquals(fixture.changes(), ids(read(base + "/changes" + query)));
        String passQuery = query + "&result=PASS&actorId=991&stage=COLLECTION&timePoint=1h";
        assertEquals(fixture.passes(), ids(read(base + "/records" + passQuery)));
        assertTrue(read(base + "/records" + query + "&collectDate=2099-01-01").isEmpty());
        assertTrue(read(base + "/changes" + query + "&actorId=992").isEmpty());

        assertEquals(fixture.records(), csvIds(base + "/records/export" + query));
        assertEquals(fixture.changes(), csvIds(base + "/changes/export" + query));
        assertEquals(fixture.passes(), csvIds(base + "/records/export" + passQuery));
        assertTrue(csvIds(base + "/changes/export" + query + "&actorId=992").isEmpty());
        assertTrue(csvIds("/" + fixture.otherProject() + "/records/export" + query).isEmpty());
        assertEquals(fixture.before(), archives(fixture.project()));
    }

    @Test
    void onlyCompleteRegisteredTubeAliasesExpandHistoryAndLiteralKeywordsStillWork() throws Exception {
        var fixture = history();
        String base = "/" + fixture.project() + "/records?keyword=";
        String fragment = fixture.alias().substring(2);
        Set<String> literalMatches = new HashSet<>();
        fixture.before().forEach((id, payload) -> {
            if (payload.contains(fragment)) literalMatches.add(id);
        });
        assertEquals(literalMatches, ids(read(base + fragment)));
        String otherNamespace = registry.allocate("SAMPLE_TASK", fixture.tubeId());
        assertTrue(read(base + otherNamespace).isEmpty());
        assertTrue(read(base + "999999999999").isEmpty());
        assertEquals(fixture.unrelated(), ids(read(base + "literal-search-marker")));
    }

    private History history() throws Exception {
        String p = project(), other = project();
        String id = ExperimentRepository.id(), code = "Eold-" + ExperimentRepository.id().substring(0, 20);
        var snapshot = Map.<String, Object>of("id", id, "projectId", Long.valueOf(p), "code", code);
        // These are initially stored pre-upgrade fixtures, never edited to simulate old archives.
        jdbc.update("INSERT INTO exp_tube(id,project_id,code,payload) VALUES (?,?,?,?)",
                id, Long.valueOf(p), code, repository.encode(snapshot));
        var records = new LinkedHashSet<String>();
        var changes = new LinkedHashSet<String>();
        var passes = new LinkedHashSet<String>();
        add(p, "SCAN", "PASS", Map.of("targetTubeId", id, "actual", snapshot), records, passes);
        add(p, "SCAN", "PASS", Map.of("scannedContent", code), records, passes);
        add(p, "TUBE_VOID", "CHANGE", Map.of("entityId", id, "before", snapshot, "after", snapshot), records, changes);
        add(p, "PRINT_REQUEST", "CHANGE", Map.of("after", Map.of("tubes", List.of(snapshot))), records, changes);
        add(p, "TUBE_CREATE", "CHANGE", Map.of("after", Map.of("code", code)), records, changes);
        add(p, "TUBE_VOID", "CHANGE", Map.of("before", Map.of("id", id)), records, changes);
        add(p, "SCAN", "PASS", Map.of("expected", Map.of("sourceTubeId", id,
                "stage", "COLLECTION", "timePoint", "1h")), records, passes);
        String alias = registry.allocate("TUBE", id);
        var current = new LinkedHashMap<>(snapshot);
        current.put("barcode", alias);
        add(p, "SCAN", "PASS", Map.of("scannedContent", alias, "actual", current), records, passes);
        add(p, "TUBE_REISSUE", "CHANGE", Map.of("entityId", id, "before", snapshot, "after", current), records, changes);

        var unrelated = new LinkedHashSet<String>();
        add(p, "SCAN", "PASS", Map.of("targetTubeId", id + "-other", "actual",
                Map.of("id", id + "-other", "code", code + "-other"), "message", "literal-search-marker"), unrelated);
        add(p, "SCAN", "PASS", Map.of("message", id));
        // Even malformed cross-project references must not be included by the alias expansion.
        add(other, "SCAN", "PASS", Map.of("targetTubeId", id, "actual", snapshot));
        return new History(p, other, id, code, alias, records, changes, passes, unrelated, archives(p));
    }

    @SafeVarargs
    private final void add(String p, String action, String result, Map<String, Object> details, Set<String>... groups) {
        var row = new LinkedHashMap<String, Object>(Map.of("projectId", Long.valueOf(p),
                "action", action, "result", result, "actorId", 991,
                "collectDate", "2026-10-05", "expected", Map.of("stage", "COLLECTION", "timePoint", "1h")));
        row.putAll(details);
        repository.save("event", row);
        for (var group : groups) group.add(row.get("id").toString());
    }

    private Map<String, String> archives(String p) {
        var rows = jdbc.query("SELECT id,payload FROM exp_event WHERE project_id=?",
                (rs, n) -> Map.entry(rs.getString(1), rs.getString(2)), Long.valueOf(p));
        var result = new LinkedHashMap<String, String>();
        rows.forEach(row -> result.put(row.getKey(), row.getValue()));
        return result;
    }

    private Set<String> ids(JsonNode rows) {
        var ids = new HashSet<String>();
        rows.forEach(row -> ids.add(row.path("id").asText()));
        return ids;
    }

    private Set<String> csvIds(String path) throws Exception {
        byte[] bytes = mvc.perform(get("/api/experiments" + path)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        String csv = new String(bytes, StandardCharsets.UTF_8);
        assertTrue(csv.startsWith("\ufeffid,createdAt,action,result,"));
        var ids = new HashSet<String>();
        csv.lines().skip(1).filter(line -> !line.isBlank()).forEach(line -> {
            String cell = line.substring(0, line.indexOf(','));
            ids.add(cell.replace("\"", ""));
        });
        return ids;
    }

    private record History(String project, String otherProject, String tubeId, String code, String alias,
            Set<String> records, Set<String> changes, Set<String> passes, Set<String> unrelated,
            Map<String, String> before) {}
}
