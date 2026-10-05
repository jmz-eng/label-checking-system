package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.*;

import com.tagmanagement.common.BusinessException;

import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.*;

@Service
public class ExperimentDataService {
    final ExperimentRepository r;
    final ExperimentAuditService audit;

    public ExperimentDataService(ExperimentRepository r, ExperimentAuditService audit) {
        this.r = r;
        this.audit = audit;
    }

    public List<Map<String, Object>> projects() {
        return r.jdbc()
                .query(
                        "SELECT id FROM project_info ORDER BY id DESC",
                        (rs, n) -> r.project(rs.getLong(1)));
    }

    public Map<String, Object> createProject(Map<String, Object> b) {
        return r.mutate(
                "project.create",
                b,
                () -> {
                    String code = required(b, "projectCode"), name = required(b, "projectName");
                    if (code.length() > 64 || name.length() > 128)
                        throw BusinessException.badRequest("试验编号或名称过长");
                    if (r.jdbc()
                                    .queryForObject(
                                            "SELECT COUNT(*) FROM project_info WHERE"
                                                    + " project_code=?",
                                            Integer.class,
                                            code)
                            > 0) throw BusinessException.conflict("试验编号已存在");
                    long p = r.insertProject(code, name);
                    var result = r.project(p);
                    audit.append(p, "PROJECT_CREATE", "CHANGE", Map.of("after", result));
                    return result;
                });
    }

    public Map<String, Object> mapping(long p, String id, Map<String, Object> b, boolean remove) {
        return r.mutate(
                "mapping." + p + "." + id + "." + remove,
                b,
                () -> {
                    r.project(p);
                    r.lockProject(p);
                    return writeMapping(p, id, b, remove);
                });
    }

    Map<String, Object> writeMapping(long p, String id, Map<String, Object> b, boolean remove) {
        Map<String, Object> before = id == null ? Map.of() : r.scopedLock("mapping", p, id);
        if (id != null) required(b, "reason");
        var row = new LinkedHashMap<String, Object>(before);
        String animal = remove ? str(before, "animalNo") : required(b, "animalNo"),
                chip = remove ? str(before, "chipNo") : required(b, "chipNo");
        bounded("animalNo", animal);
        bounded("chipNo", chip);
        for (var other : r.list("mapping", p))
            if (yes(other, "active")
                    && !Objects.equals(id, other.get("id"))
                    && (animal.equals(other.get("animalNo")) || chip.equals(other.get("chipNo"))))
                throw BusinessException.conflict("动物号或芯片号已有有效对应关系");
        row.putAll(
                Map.of(
                        "projectId",
                        p,
                        "animalNo",
                        animal,
                        "chipNo",
                        chip,
                        "active",
                        !remove,
                        "version",
                        before.isEmpty() ? 1 : number(before.get("version")) + 1));
        r.save("mapping", row);
        audit.append(
                p,
                remove ? "MAPPING_DELETE" : id == null ? "MAPPING_ADD" : "MAPPING_EDIT",
                "CHANGE",
                Map.of(
                        "entityId",
                        row.get("id"),
                        "before",
                        before,
                        "after",
                        row,
                        "reason",
                        str(b, "reason")));
        return row;
    }

    public Map<String, Object> purpose(long p, String id, Map<String, Object> b, boolean remove) {
        return r.mutate(
                "purpose." + p + "." + id + "." + remove,
                b,
                () -> {
                    r.project(p);
                    r.lockProject(p);
                    var before =
                            id == null ? Map.<String, Object>of() : r.scopedLock("purpose", p, id);
                    var row = new LinkedHashMap<String, Object>(before);
                    if (id != null) required(b, "reason");
                    if (!remove) {
                        if (!yes(b, "confirmed")) throw BusinessException.badRequest("用途规则必须明确确认");
                        row.put("name", required(b, "name"));
                        for (String k : List.of("collectionKeywords", "aliquotKeywords")) {
                            Object words = b.getOrDefault(k, List.of());
                            if (!(words instanceof List<?> l)
                                    || l.size() > 50
                                    || l.stream()
                                            .anyMatch(
                                                    w ->
                                                            !(w instanceof String)
                                                                    || w.toString().isBlank()
                                                                    || w.toString().length() > 100))
                                throw BusinessException.badRequest("关键词格式错误");
                            row.put(k, words);
                        }
                    }
                    row.putAll(
                            Map.of(
                                    "projectId",
                                    p,
                                    "active",
                                    !remove,
                                    "confirmed",
                                    !remove,
                                    "version",
                                    before.isEmpty() ? 1 : number(before.get("version")) + 1));
                    r.save("purpose", row);
                    audit.append(
                            p,
                            remove ? "PURPOSE_DELETE" : "PURPOSE_SAVE",
                            "CHANGE",
                            Map.of(
                                    "entityId",
                                    row.get("id"),
                                    "before",
                                    before,
                                    "after",
                                    row,
                                    "reason",
                                    str(b, "reason")));
                    return row;
                });
    }

    Map<String, Object> activePurpose(long p, String id) {
        var u = r.scoped("purpose", p, id);
        if (!yes(u, "active") || !yes(u, "confirmed"))
            throw BusinessException.badRequest("用途未确认或已停用");
        return u;
    }

    Map<String, Object> animal(long p, String animal) {
        return r.list("mapping", p).stream()
                .filter(m -> yes(m, "active") && animal.equals(m.get("animalNo")))
                .findFirst()
                .orElseThrow(() -> BusinessException.badRequest("动物号没有有效芯片对应关系"));
    }

    static void bounded(String key, String value) {
        int max =
                switch (key) {
                    case "animalNo", "projectCode" -> 64;
                    case "chipNo" -> 128;
                    default -> 2000;
                };
        if (value.isBlank() || value.length() > max)
            throw BusinessException.badRequest(key + " 必填且长度不可超过" + max);
    }

    static void date(String date) {
        try {
            if (!LocalDate.parse(date).toString().equals(date)) throw new Exception();
        } catch (Exception ex) {
            throw BusinessException.badRequest("采样日期须为有效的 yyyy-MM-dd 日期");
        }
    }

    public Map<String, Object> tube(long p, String id, Map<String, Object> b, String action) {
        return r.mutate(
                "tube." + p + "." + id + "." + action,
                b,
                () -> {
                    r.project(p);
                    r.lockProject(p);
                    return writeTube(p, id, b, action);
                });
    }

    Map<String, Object> writeTube(long p, String id, Map<String, Object> b, String action) {
        var before = id == null ? Map.<String, Object>of() : r.scopedLock("tube", p, id);
        if (id != null) {
            required(b, "reason");
            if (!"ACTIVE".equals(before.get("status"))) throw BusinessException.conflict("原管已作废");
        }
        if ("void".equals(action)) {
            var dead = r.copy(before);
            dead.put("status", "VOID");
            dead.put("voidReason", required(b, "reason"));
            r.save("tube", dead);
            audit.append(
                    p,
                    "TUBE_VOID",
                    "CHANGE",
                    Map.of(
                            "entityId",
                            id,
                            "before",
                            before,
                            "after",
                            dead,
                            "reason",
                            b.get("reason")));
            return dead;
        }
        var row = new LinkedHashMap<String, Object>(before);
        for (String k :
                List.of(
                        "kind",
                        "animalNo",
                        "timePoint",
                        "labelInfo",
                        "collectDate",
                        "purposeId",
                        "sourceTubeId",
                        "expiresAt")) if (b.containsKey(k)) row.put(k, b.get(k));
        row.remove("id");
        row.remove("createdAt");
        row.put("projectId", p);
        row.put("projectCode", str(r.project(p), "projectCode"));
        String kind = required(row, "kind");
        if (!Set.of("COLLECTION", "ALIQUOT").contains(kind))
            throw BusinessException.badRequest("管类型错误");
        bounded("animalNo", required(row, "animalNo"));
        animal(p, required(row, "animalNo"));
        required(row, "timePoint");
        required(row, "labelInfo");
        date(required(row, "collectDate"));
        if (!str(row, "expiresAt").isEmpty()) {
            try {
                java.time.Instant.parse(str(row, "expiresAt"));
            } catch (Exception e) {
                throw BusinessException.badRequest("expiresAt须为ISO时间");
            }
        }
        String purpose = str(row, "purposeId");
        boolean confirmed =
                b.containsKey("confirmed") ? yes(b, "confirmed") : yes(before, "confirmed");
        if (!purpose.isEmpty()) {
            activePurpose(p, purpose);
            if (!confirmed) throw BusinessException.badRequest("用途须明确确认");
        } else confirmed = false;
        row.put("confirmed", confirmed);
        row.put("sourceTubeId", kind.equals("COLLECTION") ? "" : str(row, "sourceTubeId"));
        if (kind.equals("ALIQUOT")) {
            String source = str(row, "sourceTubeId");
            if (!source.isEmpty()) validateSource(p, row, source);
            else if (confirmed) {
                var parents =
                        r.list("tube", p).stream()
                                .filter(
                                        t ->
                                                "COLLECTION".equals(t.get("kind"))
                                                        && "ACTIVE".equals(t.get("status"))
                                                        && yes(t, "confirmed")
                                                        && tuple(row, t))
                                .toList();
                if (parents.size() == 1) row.put("sourceTubeId", parents.get(0).get("id"));
            }
        }
        row.put("code", "E" + Base64.getUrlEncoder().withoutPadding().encodeToString(uuidBytes()));
        row.put("status", "ACTIVE");
        row.put("printed", false);
        row.put("version", before.isEmpty() ? 1 : number(before.get("version")) + 1);
        row.put("replacesId", id == null ? "" : id);
        // Import provenance survives corrections/reissues.
        for (String k : List.of("importId", "sourceRow", "sourceSheet"))
            if (b.containsKey(k)) row.put(k, b.get(k));
        if (id != null) {
            var dead = r.copy(before);
            dead.put("status", "VOID");
            dead.put("voidReason", str(b, "reason"));
            r.save("tube", dead);
        }
        r.save("tube", row);
        audit.append(
                p,
                id == null ? "TUBE_CREATE" : "TUBE_REISSUE",
                "CHANGE",
                Map.of(
                        "entityId",
                        row.get("id"),
                        "before",
                        before,
                        "after",
                        row,
                        "reason",
                        str(b, "reason")));
        return row;
    }

    static byte[] uuidBytes() {
        var u = UUID.randomUUID();
        return java.nio.ByteBuffer.allocate(16)
                .putLong(u.getMostSignificantBits())
                .putLong(u.getLeastSignificantBits())
                .array();
    }

    static boolean tuple(Map<String, Object> a, Map<String, Object> b) {
        return List.of("projectId", "animalNo", "timePoint", "collectDate", "purposeId").stream()
                .allMatch(k -> str(a, k).equals(str(b, k)));
    }

    void validateSource(long p, Map<String, Object> row, String source) {
        var s = r.scoped("tube", p, source);
        if (!"COLLECTION".equals(s.get("kind"))
                || !"ACTIVE".equals(s.get("status"))
                || !yes(s, "confirmed")
                || !tuple(row, s)) throw BusinessException.badRequest("来源管与动物、日期、时间点或用途不符");
    }

    boolean eligible(Map<String, Object> t) {
        if (!"ACTIVE".equals(t.get("status")) || !yes(t, "confirmed")) return false;
        try {
            activePurpose(number(t.get("projectId")), str(t, "purposeId"));
            if (!str(t, "expiresAt").isEmpty()
                    && java.time.Instant.parse(str(t, "expiresAt"))
                            .isBefore(java.time.Instant.now())) return false;
            if ("ALIQUOT".equals(t.get("kind"))) {
                if (str(t, "sourceTubeId").isEmpty()) return false;
                validateSource(number(t.get("projectId")), t, str(t, "sourceTubeId"));
            }
            return true;
        } catch (BusinessException ex) {
            return false;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> assign(long p, Map<String, Object> b) {
        return r.mutate(
                "assign." + p,
                b,
                () -> {
                    r.lockProject(p);
                    Object v = b.get("assignments");
                    if (!(v instanceof List<?> rows) || rows.isEmpty() || rows.size() > 1000)
                        throw BusinessException.badRequest("assignments需1至1000行");
                    var tubeIds = new ArrayList<String>();
                    for (Object o : rows) tubeIds.add(required((Map<String, Object>) o, "tubeId"));
                    r.lockTubes(tubeIds);
                    List<Map<String, Object>> out = new ArrayList<>();
                    for (Object o : rows) {
                        Map<String, Object> row = new LinkedHashMap<>((Map<String, Object>) o);
                        row.put("reason", required(b, "reason"));
                        row.put("confirmed", yes(b, "confirmed"));
                        out.add(writeTube(p, required(row, "tubeId"), row, "edit"));
                    }
                    return Map.of("tubes", out);
                });
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> print(long p, Map<String, Object> b) {
        return r.mutate(
                "print." + p,
                b,
                () -> {
                    r.project(p);
                    Object ids = b.get("tubeIds");
                    if (!(ids instanceof List<?> list) || list.isEmpty() || list.size() > 1000)
                        throw BusinessException.badRequest("tubeIds需1至1000项");
                    var locked = r.lockTubes((List<String>) list);
                    r.lockPurposes(locked.values().stream().map(t -> str(t, "purposeId")).toList());
                    List<Map<String, Object>> snapshots = new ArrayList<>();
                    for (String id : new TreeSet<>((List<String>) list)) {
                        var t = locked.get(id);
                        if (number(t.get("projectId")) != p)
                            throw BusinessException.notFound("当前实验中不存在该数据");
                        if (!eligible(t)) throw BusinessException.conflict("仅可打印有效且用途/来源已确认的管子");
                        snapshots.add(r.copy(t));
                        t.put("printed", true);
                        r.save("tube", t);
                    }
                    var row = new LinkedHashMap<String, Object>();
                    row.putAll(
                            Map.of(
                                    "projectId",
                                    p,
                                    "actorId",
                                    com.tagmanagement.security.CurrentUserContext.get().getId(),
                                    "status",
                                    "REQUEST_ACKNOWLEDGED",
                                    "tubes",
                                    snapshots));
                    r.save("print", row);
                    audit.append(
                            p,
                            "PRINT_REQUEST",
                            "CHANGE",
                            Map.of("after", row, "message", "已记录打印请求，未声称物理打印完成"));
                    return row;
                });
    }

    public List<Map<String, Object>> filtered(String type, long p, Map<String, String> filters) {
        r.project(p);
        return r.list(type, p).stream()
                .filter(
                        row ->
                                filters.entrySet().stream()
                                        .allMatch(
                                                f -> {
                                                    if (f.getValue() == null
                                                            || f.getValue().isBlank()) return true;
                                                    Object candidate = row.get(f.getKey());
                                                    if (candidate == null
                                                            && row.get("expected")
                                                                    instanceof Map<?, ?> expected)
                                                        candidate = expected.get(f.getKey());
                                                    return f.getKey().equals("keyword")
                                                            ? r.encode(row).contains(f.getValue())
                                                            : Objects.equals(
                                                                    String.valueOf(candidate),
                                                                    f.getValue());
                                                }))
                .toList();
    }
}
