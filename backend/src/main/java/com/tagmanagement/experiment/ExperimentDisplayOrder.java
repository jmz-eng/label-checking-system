package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.str;

import java.time.Instant;
import java.util.*;

/** Read-only display order recovered from existing committed import manifests. */
final class ExperimentDisplayOrder {
    private record Origin(Instant time, int index) {}

    private record Position(
            Origin origin, String root, int generation, Instant created, String id) {}

    static void sort(List<Map<String, Object>> rows, List<Map<String, Object>> batches) {
        var byId = new HashMap<String, Map<String, Object>>();
        for (var row : rows) byId.put(str(row, "id"), row);
        var imported = new HashMap<String, Origin>();
        for (var batch : batches) {
            if (!"COMMITTED".equals(batch.get("status"))
                    || !(batch.get("entityIds") instanceof List<?> ids)) continue;
            // Entity creation records confirmation order, whereas batch creation is preview time.
            Instant first =
                    ids.stream()
                            .map(Object::toString)
                            .map(byId::get)
                            .filter(Objects::nonNull)
                            .map(ExperimentDisplayOrder::created)
                            .min(Comparator.naturalOrder())
                            .orElse(null);
            if (first == null) continue;
            // entityIds were saved in workbook sheet/row order, including in older releases.
            for (int i = 0; i < ids.size(); i++)
                imported.putIfAbsent(ids.get(i).toString(), new Origin(first, i));
        }
        var positions = new HashMap<String, Position>();
        for (var row : rows) {
            var root = row;
            int generation = 0;
            var seen = new HashSet<String>();
            seen.add(str(root, "id"));
            while (true) {
                var parent = byId.get(str(root, "replacesId"));
                if (parent == null || !seen.add(str(parent, "id"))) break;
                root = parent;
                generation++;
            }
            String id = str(row, "id"), rootId = str(root, "id");
            var origin = imported.getOrDefault(rootId, new Origin(created(root), 0));
            positions.put(id, new Position(origin, rootId, generation, created(row), id));
        }
        var comparator =
                Comparator.comparing((Position p) -> p.origin.time)
                        .thenComparingInt(p -> p.origin.index)
                        .thenComparing(Position::root)
                        .thenComparingInt(Position::generation)
                        .thenComparing(Position::created)
                        .thenComparing(Position::id);
        rows.sort(Comparator.comparing(row -> positions.get(str(row, "id")), comparator));
    }

    private static Instant created(Map<String, Object> row) {
        try {
            return Instant.parse(str(row, "createdAt"));
        } catch (java.time.format.DateTimeParseException e) {
            return Instant.EPOCH;
        }
    }
}
