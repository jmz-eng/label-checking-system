package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;

import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.util.*;
import java.util.stream.StreamSupport;

class ExperimentDisplayOrderTest extends ExperimentTestSupport {
    private final List<String> animals = List.of("900", "100", "700", "200");

    byte[] workbook(String code, String kind, List<String> values) throws Exception {
        try (var book = new XSSFWorkbook();
                var out = new ByteArrayOutputStream()) {
            for (int s = 0; s < 2; s++) {
                var sheet = book.createSheet(s == 0 ? "Z先导入" : "A后导入");
                var headers =
                        kind.equals("GROUP")
                                ? ExperimentImportService.GROUP
                                : ExperimentImportService.TUBES;
                var header = sheet.createRow(0);
                for (int c = 0; c < headers.length; c++)
                    header.createCell(c).setCellValue(headers[c]);
                for (int i = s * 2; i < Math.min(s * 2 + 2, values.size()); i++) {
                    var row = sheet.createRow(i - s * 2 + 1);
                    String[] fields =
                            kind.equals("GROUP")
                                    ? new String[] {code, values.get(i), "chip-" + values.get(i)}
                                    : new String[] {
                                        code,
                                        values.get(i),
                                        "1h",
                                        kind.equals("COLLECTION") ? "原血" : "血浆",
                                        "2026-10-05"
                                    };
                    for (int c = 0; c < fields.length; c++)
                        row.createCell(c).setCellValue(fields[c]);
                }
            }
            book.write(out);
            return out.toByteArray();
        }
    }

    JsonNode commit(String p, JsonNode preview) throws Exception {
        var batch =
                call(
                        "/" + p + "/imports/" + preview.path("id").asText() + "/commit",
                        Map.of("confirmed", true));
        assertEquals("COMMITTED", batch.path("status").asText(), batch.toString());
        return batch;
    }

    List<String> ids(JsonNode rows) {
        return StreamSupport.stream(rows.spliterator(), false)
                .map(r -> r.path("id").asText())
                .toList();
    }

    List<String> entityIds(JsonNode batch) {
        return StreamSupport.stream(batch.path("entityIds").spliterator(), false)
                .map(JsonNode::asText)
                .toList();
    }

    // Force a database order opposite to the workbook, independent of UUID randomness.
    void scrambleDatabaseOrder(String table, List<String> ids) {
        for (int i = 0; i < ids.size(); i++) {
            jdbc.update(
                    "UPDATE " + table + " SET created_at=? WHERE id=?",
                    "2026-10-01 00:00:" + String.format("%02d", ids.size() - i),
                    ids.get(i));
        }
    }

    @Test
    void existingMultiSheetGroupsKeepWorkbookOrderAfterEditAndAppend() throws Exception {
        String p = project(), code = read("/" + p).path("projectCode").asText();
        // Preview the later batch first: display order must follow confirmation, not upload time.
        var later = upload(p, workbook(code, "GROUP", List.of("800", "050")), "GROUP");
        var first = commit(p, upload(p, workbook(code, "GROUP", animals), "GROUP"));
        var second = commit(p, later);
        var expected = new ArrayList<>(entityIds(first));
        expected.addAll(entityIds(second));
        // Older payloads may have coarse timestamps too: entityIds must remain authoritative.
        for (var batch : List.of(first, second)) {
            for (String id : entityIds(batch)) {
                var payload =
                        json.readTree(
                                jdbc.queryForObject(
                                        "SELECT payload FROM exp_mapping WHERE id=?",
                                        String.class,
                                        id));
                ((com.fasterxml.jackson.databind.node.ObjectNode) payload)
                        .put(
                                "createdAt",
                                batch == first ? "2026-01-01T00:00:00Z" : "2026-01-02T00:00:00Z");
                jdbc.update("UPDATE exp_mapping SET payload=? WHERE id=?", payload.toString(), id);
            }
        }
        var manual = call("/" + p + "/mappings", Map.of("animalNo", "400", "chipNo", "chip-400"));
        expected.add(manual.path("id").asText());
        scrambleDatabaseOrder("exp_mapping", expected);
        var stored =
                jdbc.queryForList(
                        "SELECT payload FROM exp_mapping WHERE project_id=? ORDER BY id",
                        Long.valueOf(p));
        assertEquals(expected, ids(read("/" + p + "/mappings")));
        assertEquals(
                stored,
                jdbc.queryForList(
                        "SELECT payload FROM exp_mapping WHERE project_id=? ORDER BY id",
                        Long.valueOf(p)),
                "Sorting must not rewrite stored records");
        call(
                "/" + p + "/mappings/" + expected.get(1),
                Map.of("animalNo", "100", "chipNo", "new-chip", "reason", "纠正芯片"));
        assertEquals(expected, ids(read("/" + p + "/mappings")));
    }

    @Test
    void collectionAndAliquotOrderSurvivesReplacementAndFiltering() throws Exception {
        String p = project(), u = purpose(p), code = read("/" + p).path("projectCode").asText();
        commit(p, upload(p, workbook(code, "GROUP", animals), "GROUP"));
        var collection = commit(p, upload(p, workbook(code, "COLLECTION", animals), "COLLECTION"));
        var reversedAnimals = new ArrayList<>(animals);
        Collections.reverse(reversedAnimals);
        var aliquot = commit(p, upload(p, workbook(code, "ALIQUOT", reversedAnimals), "ALIQUOT"));
        var all = new ArrayList<>(entityIds(collection));
        all.addAll(entityIds(aliquot));
        scrambleDatabaseOrder("exp_tube", all);
        assertEquals(entityIds(collection), ids(read("/" + p + "/tubes?kind=COLLECTION")));
        assertEquals(entityIds(aliquot), ids(read("/" + p + "/tubes?kind=ALIQUOT")));
        String original = entityIds(aliquot).get(1);
        var replacement =
                call(
                        "/" + p + "/tubes/" + original,
                        Map.of("labelInfo", "血浆-更正", "reason", "更正标签"));
        var current = new ArrayList<>(entityIds(aliquot));
        current.set(1, replacement.path("id").asText());
        assertEquals(current, ids(read("/" + p + "/tubes?kind=ALIQUOT&status=ACTIVE")));
        var secondReplacement =
                call(
                        "/" + p + "/tubes/" + replacement.path("id").asText(),
                        Map.of("labelInfo", "血浆-再次更正", "reason", "再次更正标签"));
        current.set(1, secondReplacement.path("id").asText());
        assertEquals(current, ids(read("/" + p + "/tubes?kind=ALIQUOT&status=ACTIVE")));
        assertEquals(u, secondReplacement.path("purposeId").asText());
        assertEquals(original, replacement.path("replacesId").asText());
    }

    @Test
    void printSnapshotAndIdempotentRecoveryPreserveChosenOrder() throws Exception {
        String p = project(), u = purpose(p);
        mapping(p);
        var a = tube(p, u, "COLLECTION", null, "2026-10-05");
        var b = tube(p, u, "COLLECTION", null, "2026-10-05");
        var c = tube(p, u, "COLLECTION", null, "2026-10-05");
        var order =
                new ArrayList<>(
                        List.of(
                                a.path("id").asText(),
                                b.path("id").asText(),
                                c.path("id").asText()));
        order.sort(Comparator.reverseOrder());
        var withDuplicate = new ArrayList<>(order);
        withDuplicate.add(order.get(0));
        var request =
                Map.<String, Object>of(
                        "tubeIds", withDuplicate, "requestId", UUID.randomUUID().toString());
        var printed = call("/" + p + "/print-requests", request);
        assertEquals(order, ids(printed.path("tubes")));
        assertEquals(printed, call("/" + p + "/print-requests", request));
        assertEquals(order, ids(read("/" + p + "/print-requests").get(0).path("tubes")));
    }
}
