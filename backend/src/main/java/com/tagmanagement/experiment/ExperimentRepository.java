package com.tagmanagement.experiment;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.security.CurrentUserContext;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import java.util.function.Supplier;

/** SQL ownership, row locks, immutable archives and actor-scoped request deduplication. */
@Repository
public class ExperimentRepository {
    final com.tagmanagement.barcode.BarcodeRegistry barcodes;
    final JdbcTemplate jdbc;
    final ObjectMapper json;
    final TransactionTemplate tx;
    private static final Set<String> TABLES =
            Set.of("mapping", "purpose", "tube", "session", "event", "import", "print");

    public ExperimentRepository(
            JdbcTemplate jdbc, ObjectMapper json, PlatformTransactionManager tm,
            com.tagmanagement.barcode.BarcodeRegistry barcodes) {
        this.barcodes = barcodes;
        this.jdbc = jdbc;
        this.json = json;
        tx = new TransactionTemplate(tm);
        // Every validation read after waiting for a row lock must see committed changes.
        // Do not inherit MySQL's REPEATABLE READ snapshot established by request lookup.
        tx.setIsolationLevel(
                org.springframework.transaction.TransactionDefinition.ISOLATION_READ_COMMITTED);
        tx.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    public JdbcTemplate jdbc() {
        return jdbc;
    }

    public static Map<String, Object> fields(Object... pairs) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < pairs.length; i += 2) m.put((String) pairs[i], pairs[i + 1]);
        return m;
    }

    public static String id() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    public static String str(Map<String, Object> m, String k) {
        Object v = m.get(k);
        return v == null ? "" : v.toString();
    }

    public static String required(Map<String, Object> m, String k) {
        String v = str(m, k).trim();
        if (v.isEmpty() || v.length() > 2000)
            throw BusinessException.badRequest(k + " 必填且长度不可超过2000");
        return v;
    }

    public static boolean yes(Map<String, Object> m, String k) {
        return Boolean.TRUE.equals(m.get(k));
    }

    public static long number(Object n) {
        return Long.parseLong(n.toString());
    }

    public String encode(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public Map<String, Object> decode(String s) {
        try {
            return json.readValue(s, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public Map<String, Object> copy(Map<String, Object> m) {
        return decode(encode(m));
    }

    public static String hash(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String table(String type) {
        if (!TABLES.contains(type)) throw new IllegalArgumentException(type);
        return "exp_" + type;
    }

    public Map<String, Object> get(String type, String id) {
        var rows =
                jdbc.query(
                        "SELECT payload FROM " + table(type) + " WHERE id=?",
                        (r, n) -> decode(r.getString(1)),
                        id);
        if (rows.isEmpty()) throw BusinessException.notFound(type + " 不存在");
        return live(type, rows.get(0));
    }

    public Map<String, Object> lock(String type, String id) {
        var rows =
                jdbc.query(
                        "SELECT payload FROM " + table(type) + " WHERE id=? FOR UPDATE",
                        (r, n) -> decode(r.getString(1)),
                        id);
        if (rows.isEmpty()) throw BusinessException.notFound(type + " 不存在");
        return live(type, rows.get(0));
    }

    public Map<String, Object> scopedLock(String type, long p, String id) {
        var row = lock(type, id);
        if (number(row.get("projectId")) != p) throw BusinessException.notFound("当前实验中不存在该数据");
        return row;
    }

    /**
     * Shared order: actor, optional project/session, sorted tubes, sorted purposes, mapping. Tube
     * content/source identity is immutable; corrections always create a new identity.
     */
    public Map<String, Map<String, Object>> lockTubes(Collection<String> ids) {
        var sorted = new TreeSet<String>();
        for (String id : ids) {
            if (id == null || id.isBlank()) continue;
            sorted.add(id);
            String source = str(get("tube", id), "sourceTubeId");
            if (!source.isBlank()) sorted.add(source);
        }
        var rows = new LinkedHashMap<String, Map<String, Object>>();
        for (String id : sorted) rows.put(id, lock("tube", id));
        return rows;
    }

    public Map<String, Map<String, Object>> lockPurposes(Collection<String> ids) {
        var rows = new LinkedHashMap<String, Map<String, Object>>();
        for (String id : new TreeSet<>(ids)) if (!id.isBlank()) rows.put(id, lock("purpose", id));
        return rows;
    }

    public List<Map<String, Object>> list(String type, long project) {
        var rows = jdbc.query(
                "SELECT payload FROM " + table(type) + " WHERE project_id=? ORDER BY created_at,id",
                (r, n) -> decode(r.getString(1)),
                project);
        // Release the nontransactional query connection before alias lookups. A caller's
        // transaction still retains its connection and row locks through the usual JDBC binding.
        rows.forEach(row -> live(type, row));
        return rows;
    }

    private Map<String, Object> live(String type, Map<String, Object> row) {
        if (type.equals("tube")) row.put("barcode", barcodes.existing("TUBE", str(row, "id")));
        return row;
    }

    public List<Map<String, Object>> tubesForScan(String content) {
        String entity = barcodes.resolve("TUBE", content);
        return jdbc.query("SELECT payload FROM exp_tube WHERE " + (entity == null ? "code=?" : "id=?"),
                (r, n) -> decode(r.getString(1)), entity == null ? content : entity);
    }

    public Map<String, Object> tubeForHistory(long project, String keyword) {
        String entity = barcodes.resolve("TUBE", keyword);
        if (entity == null) return null;
        var rows = jdbc.query("SELECT payload FROM exp_tube WHERE id=? AND project_id=?",
                (r, n) -> decode(r.getString(1)), entity, project);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public void save(String type, Map<String, Object> row) {
        String id = str(row, "id");
        if (id.isEmpty()) {
            row.put("id", id());
            row.put("createdAt", Instant.now().toString());
            jdbc.update(
                    "INSERT INTO " + table(type) + "(id,project_id,payload) VALUES (?,?,?)",
                    row.get("id"),
                    row.get("projectId"),
                    encode(row));
        } else {
            if (type.equals("event")) throw new IllegalStateException("Archives are append-only");
            jdbc.update("UPDATE " + table(type) + " SET payload=? WHERE id=?", encode(row), id);
        }
        if (type.equals("tube")) row.put("barcode", barcodes.allocate("TUBE", str(row, "id")));
        if (type.equals("tube"))
            jdbc.update("UPDATE exp_tube SET code=? WHERE id=?", row.get("code"), row.get("id"));
        if (type.equals("session"))
            jdbc.update(
                    "UPDATE exp_session SET owner_id=? WHERE id=?",
                    row.get("ownerId"),
                    row.get("id"));
        if (type.equals("mapping"))
            jdbc.update(
                    "UPDATE exp_mapping SET active_animal=?,active_chip=? WHERE id=?",
                    yes(row, "active") ? row.get("animalNo") : null,
                    yes(row, "active") ? row.get("chipNo") : null,
                    row.get("id"));
    }

    public Map<String, Object> scoped(String type, long p, String id) {
        var r = get(type, id);
        if (number(r.get("projectId")) != p) throw BusinessException.notFound("当前实验中不存在该数据");
        return r;
    }

    public Map<String, Object> mutate(
            String operation, Map<String, Object> body, Supplier<Map<String, Object>> work) {
        String request = required(body, "requestId");
        if (request.length() > 128) throw BusinessException.badRequest("requestId过长");
        long actor = CurrentUserContext.get().getId();
        String payload = canonical(body);
        String fingerprint = hash((operation + "\n" + payload).getBytes(StandardCharsets.UTF_8));
        return tx.execute(
                status -> {
                    // Serializes a user's concurrent requests without locking the experiment or
                    // other operators.
                    jdbc.queryForObject(
                            "SELECT id FROM sys_user WHERE id=? FOR UPDATE", Long.class, actor);
                    var old =
                            jdbc.query(
                                    "SELECT fingerprint,response FROM exp_request WHERE actor_id=?"
                                            + " AND request_id=?",
                                    (r, n) -> List.of(r.getString(1), r.getString(2)),
                                    actor,
                                    request);
                    if (!old.isEmpty()) {
                        if (!old.get(0).get(0).equals(fingerprint))
                            throw BusinessException.conflict("requestId已用于不同内容");
                        return decode(old.get(0).get(1));
                    }
                    Map<String, Object> result = work.get();
                    jdbc.update(
                            "INSERT INTO exp_request(actor_id,request_id,fingerprint,response)"
                                    + " VALUES (?,?,?,?)",
                            actor,
                            request,
                            fingerprint,
                            encode(result));
                    return result;
                });
    }

    private String canonical(Object value) {
        if (value instanceof Map<?, ?> m) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            m.forEach((k, v) -> sorted.put(k.toString(), v));
            StringJoiner j = new StringJoiner(",", "{", "}");
            sorted.forEach((k, v) -> j.add(encode(k) + ":" + canonical(v)));
            return j.toString();
        }
        if (value instanceof List<?> l) {
            StringJoiner j = new StringJoiner(",", "[", "]");
            l.forEach(v -> j.add(canonical(v)));
            return j.toString();
        }
        return encode(value);
    }

    public Map<String, Object> project(long id) {
        var rows =
                jdbc.query(
                        "SELECT id,project_code,project_name,status FROM project_info WHERE id=?",
                        (r, n) ->
                                new LinkedHashMap<String, Object>(
                                        Map.of(
                                                "id",
                                                r.getLong(1),
                                                "projectCode",
                                                r.getString(2),
                                                "projectName",
                                                r.getString(3),
                                                "status",
                                                r.getString(4))),
                        id);
        if (rows.isEmpty()) throw BusinessException.notFound("实验不存在");
        return rows.get(0);
    }

    public void lockProject(long p) {
        jdbc.queryForObject("SELECT id FROM project_info WHERE id=? FOR UPDATE", Long.class, p);
    }

    public long insertProject(String code, String name) {
        var keys = new GeneratedKeyHolder();
        jdbc.update(
                c -> {
                    var s =
                            c.prepareStatement(
                                    "INSERT INTO"
                                        + " project_info(project_code,project_name,test_article,owner_id,status)"
                                        + " VALUES (?,?,'',?,'ACTIVE')",
                                    new String[] {"id"});
                    s.setString(1, code);
                    s.setString(2, name);
                    s.setLong(3, CurrentUserContext.get().getId());
                    return s;
                },
                keys);
        return Objects.requireNonNull(keys.getKey()).longValue();
    }
}
