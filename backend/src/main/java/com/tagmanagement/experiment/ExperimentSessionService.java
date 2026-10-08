package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.*;

import com.tagmanagement.common.BusinessException;
import com.tagmanagement.security.CurrentUserContext;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ExperimentSessionService {
    final ExperimentRepository r;
    final ExperimentAuditService audit;
    final ExperimentDataService data;

    public ExperimentSessionService(
            ExperimentRepository r, ExperimentDataService data, ExperimentAuditService audit) {
        this.r = r;
        this.audit = audit;
        this.data = data;
    }

    void permission(String stage) {
        String code = stage.equals("COLLECTION") ? "sample:verify" : "sample:record";
        if (!CurrentUserContext.get().hasPermission(code))
            throw BusinessException.forbidden("无权进行此阶段核对");
    }

    public Map<String, Object> get(String id) {
        var s = r.get("session", id);
        owner(s);
        return s;
    }

    void owner(Map<String, Object> s) {
        if (number(s.get("ownerId")) != CurrentUserContext.get().getId())
            throw BusinessException.forbidden("不能访问其他操作员会话");
        permission(str(s, "stage"));
    }

    List<Map<String, Object>> own() {
        long actor = CurrentUserContext.get().getId();
        return r.jdbc()
                .query(
                        "SELECT payload FROM exp_session WHERE owner_id=? ORDER BY created_at"
                                + " DESC,id",
                        (rs, n) -> r.decode(rs.getString(1)),
                        actor);
    }

    public Map<String, Object> current() {
        return own().stream()
                .filter(s -> !"SUPERSEDED".equals(s.get("state")))
                .findFirst()
                .map(
                        s -> {
                            owner(s);
                            return s;
                        })
                .orElse(Map.of());
    }

    private void authoritative(Map<String, Object> session) {
        var current = own().stream().filter(s -> !"SUPERSEDED".equals(s.get("state"))).findFirst();
        if (current.isEmpty() || !str(current.get(), "id").equals(str(session, "id")))
            throw BusinessException.conflict("会话已被新会话替代，请刷新当前会话");
        if (own().stream()
                .anyMatch(
                        s ->
                                "FAILED".equals(s.get("state"))
                                        && !str(s, "id").equals(str(session, "id"))))
            throw BusinessException.conflict("尚有其他失败轮次，须先纠正或异常结束");
    }

    public Map<String, Object> start(long p, Map<String, Object> b) {
        String stage = required(b, "stage");
        if (!Set.of("COLLECTION", "ALIQUOT").contains(stage))
            throw BusinessException.badRequest("stage错误");
        permission(stage);
        return r.mutate(
                "session.start." + p,
                b,
                () -> {
                    r.lockProject(p);
                    if (own().stream().anyMatch(s -> "FAILED".equals(s.get("state"))))
                        throw BusinessException.conflict("尚有失败轮次，须纠正通过或填写原因异常结束");
                    ExperimentDataService.date(required(b, "collectDate"));
                    String time = required(b, "timePoint"), purpose = required(b, "purposeId");
                    var rule = data.activePurpose(p, purpose);
                    for (var old : own())
                        if (!"SUPERSEDED".equals(str(old, "state"))) {
                            var before = r.copy(old);
                            old.put("state", "SUPERSEDED");
                            r.save("session", old);
                            audit.append(
                                    number(old.get("projectId")),
                                    "CONTEXT_CHANGE",
                                    "CHANGE",
                                    Map.of("before", before, "after", old));
                        }
                    var s = new LinkedHashMap<String, Object>();
                    s.putAll(
                            Map.of(
                                    "projectId",
                                    p,
                                    "ownerId",
                                    CurrentUserContext.get().getId(),
                                    "stage",
                                    stage,
                                    "collectDate",
                                    b.get("collectDate"),
                                    "timePoint",
                                    time,
                                    "purposeId",
                                    purpose,
                                    "purposeSnapshot",
                                    rule,
                                    "round",
                                    1,
                                    "state",
                                    "IN_PROGRESS",
                                    "pending",
                                    stage.equals("COLLECTION") ? "CHIP" : "SOURCE_TUBE"));
                    r.save("session", s);
                    audit.append(p, "SESSION_START", "CHANGE", Map.of("after", s));
                    return s;
                });
    }

    public Map<String, Object> scan(String id, Map<String, Object> b, boolean chip) {
        get(id);
        return r.mutate(
                "session.scan." + id + "." + chip,
                b,
                () -> {
                    var s = r.lock("session", id);
                    owner(s);
                    authoritative(s);
                    if (Set.of("PASSED", "ABORTED", "SUPERSEDED").contains(str(s, "state")))
                        throw BusinessException.conflict("本轮已结束，请开始下一轮");
                    required(b, "content");
                    String raw = str(b, "content"), content = raw.trim();
                    long p = number(s.get("projectId"));
                    if (chip) return chip(s, raw, content, p);
                    if ("CHIP".equals(s.get("pending")))
                        return finish(s, raw, null, "FAIL", "请先扫描动物芯片");
                    var matches = r.tubesForScan(content);
                    if (matches.isEmpty()) return finish(s, raw, null, "FAIL", "未知标签码");
                    var t = matches.get(0);
                    Map<String, Map<String, Object>> lockedTubes;
                    Map<String, Map<String, Object>> rules;
                    try {
                        lockedTubes =
                                r.lockTubes(List.of(str(t, "id"), str(s, "sourceTubeId")));
                        t = lockedTubes.get(str(t, "id"));
                        var purposeIds = new ArrayList<String>();
                        purposeIds.add(str(s, "purposeId"));
                        lockedTubes.values().forEach(tube -> purposeIds.add(str(tube, "purposeId")));
                        rules = r.lockPurposes(purposeIds);
                    } catch (BusinessException ex) {
                        // Historical drafts can contain dangling references. An expected scan
                        // failure must commit its archive and FAILED round, not roll back as 404.
                        if (ex.getStatus() != HttpStatus.NOT_FOUND) throw ex;
                        return finish(s, raw, t, "FAIL", "标签用途或来源不存在，须修正或异常结束");
                    }
                    if (!data.eligible(t)) return finish(s, raw, t, "FAIL", "标签已作废、过期或用途/来源未确认");
                    String stage = str(s, "stage"), pending = str(s, "pending");
                    List<String> errors = new ArrayList<>();
                    for (String key : List.of("projectId", "collectDate", "timePoint", "purposeId"))
                        if (!str(s, key).equals(str(t, key))) errors.add(key + "不一致");
                    var rule = rules.get(str(s, "purposeId"));
                    if (!r.encode(rule).equals(r.encode(s.get("purposeSnapshot"))))
                        errors.add("用途规则已变更，请异常结束后重新选择");
                    validateStage(s, t, p, stage, pending, errors, lockedTubes);
                    if (!errors.isEmpty())
                        return finish(s, raw, t, "FAIL", String.join("；", errors));
                    if (stage.equals("ALIQUOT") && pending.equals("SOURCE_TUBE")) {
                        s.put("sourceTubeId", t.get("id"));
                        s.put("sourceSnapshot", t);
                        s.put("animalNo", t.get("animalNo"));
                        s.put("pending", "ALIQUOT_TUBE");
                        return finish(s, raw, t, "READY", "来源管核对完成，请扫描分装管");
                    }
                    s.put("targetTubeId", t.get("id"));
                    return finish(s, raw, t, "PASS", "核对通过（不代表实际采血或分装已完成）");
                });
    }

    private void validateStage(
            Map<String, Object> s,
            Map<String, Object> t,
            long p,
            String stage,
            String pending,
            List<String> errors,
            Map<String, Map<String, Object>> lockedTubes) {
        if (stage.equals("COLLECTION")) {
            if (!"COLLECTION".equals(t.get("kind"))) errors.add("应扫描采血管");
            if (!str(s, "animalNo").equals(str(t, "animalNo"))) errors.add("动物号不一致");
            @SuppressWarnings("unchecked")
            var previous = (Map<String, Object>) s.get("mappingSnapshot");
            var latest =
                    r.list("mapping", p).stream()
                            .filter(
                                    m ->
                                            yes(m, "active")
                                                    && str(s, "animalNo")
                                                            .equals(str(m, "animalNo")))
                            .findFirst();
            if (latest.isPresent())
                latest = Optional.of(r.lock("mapping", str(latest.get(), "id")));
            if (previous == null
                    || latest.isEmpty()
                    || !yes(latest.get(), "active")
                    || !str(previous, "version").equals(str(latest.get(), "version"))
                    || !str(previous, "id").equals(str(latest.get(), "id"))) {
                s.put("pending", "CHIP");
                errors.add("芯片对应关系已变更，须重扫当前动物芯片");
            }
        } else if (pending.equals("SOURCE_TUBE")) {
            if (!"COLLECTION".equals(t.get("kind"))) errors.add("来源必须为采血管");
            if (!sourcePassed(p, str(t, "id"))) errors.add("该具体采血管尚无成功采血核对记录");
        } else {
            if (!"ALIQUOT".equals(t.get("kind"))) errors.add("应扫描分装管");
            if (!str(s, "sourceTubeId").equals(str(t, "sourceTubeId"))) errors.add("分装管不属于当前来源管");
            if (!str(s, "animalNo").equals(str(t, "animalNo"))) errors.add("动物号不一致");
            var source = lockedTubes.get(str(s, "sourceTubeId"));
            if (!data.eligible(source) || !sourcePassed(p, str(source, "id")))
                errors.add("当前来源管失效");
        }
    }

    private Map<String, Object> chip(Map<String, Object> s, String raw, String content, long p) {
        if (!"COLLECTION".equals(s.get("stage"))) throw BusinessException.badRequest("分装阶段不扫描芯片");
        var mapping =
                r.list("mapping", p).stream()
                        .filter(m -> yes(m, "active") && content.equals(m.get("chipNo")))
                        .findFirst();
        if (mapping.isEmpty()) return finish(s, raw, null, "FAIL", "当前实验未知芯片");
        var m = r.lock("mapping", str(mapping.get(), "id"));
        if (!yes(m, "active") || !content.equals(str(m, "chipNo"))) {
            return finish(s, raw, null, "FAIL", "芯片关系在扫描时已变更，请重新扫描");
        }
        if (!str(s, "animalNo").isEmpty() && !str(s, "animalNo").equals(str(m, "animalNo")))
            return finish(s, raw, null, "FAIL", "本轮不可更换动物，须纠正或异常结束");
        s.put("chipContent", raw);
        s.put("animalNo", m.get("animalNo"));
        s.put("mappingSnapshot", m);
        s.put("pending", "COLLECTION_TUBE");
        return finish(s, raw, null, "READY", "芯片已识别，请扫描采血管");
    }

    boolean sourcePassed(long p, String source) {
        return r.list("event", p).stream()
                .anyMatch(
                        e ->
                                "SCAN".equals(e.get("action"))
                                        && "PASS".equals(e.get("result"))
                                        && "COLLECTION".equals(e.get("stage"))
                                        && source.equals(e.get("targetTubeId")));
    }

    private Map<String, Object> finish(
            Map<String, Object> s,
            String raw,
            Map<String, Object> tube,
            String result,
            String message) {
        String state = str(s, "state");
        if (result.equals("FAIL")) s.put("state", "FAILED");
        else if (result.equals("PASS")) {
            s.put("state", "PASSED");
            s.put("pending", "NONE");
        } else if (!state.equals("FAILED")) s.put("state", "IN_PROGRESS");
        var expected = r.copy(s);
        expected.remove("lastResult");
        var details = new LinkedHashMap<String, Object>();
        details.putAll(
                fields(
                        "sessionId",
                        s.get("id"),
                        "round",
                        s.get("round"),
                        "stage",
                        s.get("stage"),
                        "expected",
                        expected,
                        "scannedContent",
                        raw,
                        "message",
                        message,
                        "sourceTubeId",
                        str(s, "sourceTubeId"),
                        "targetTubeId",
                        tube == null ? "" : str(tube, "id"),
                        "animalNo",
                        str(s, "animalNo"),
                        "collectDate",
                        s.get("collectDate"),
                        "timePoint",
                        s.get("timePoint"),
                        "purposeId",
                        s.get("purposeId")));
        if (tube != null) details.put("actual", tube);
        var event = audit.append(number(s.get("projectId")), "SCAN", result, details);
        s.put("lastResult", event);
        r.save("session", s);
        return s;
    }

    public Map<String, Object> next(String id, Map<String, Object> b) {
        get(id);
        return r.mutate(
                "session.next." + id,
                b,
                () -> {
                    r.lockProject(number(r.get("session", id).get("projectId")));
                    var s = r.lock("session", id);
                    owner(s);
                    authoritative(s);
                    if (!Set.of("PASSED", "ABORTED").contains(str(s, "state")))
                        throw BusinessException.conflict("当前轮未通过或异常结束");
                    boolean keep =
                            yes(b, "retainSource")
                                    && "ALIQUOT".equals(s.get("stage"))
                                    && !str(s, "sourceTubeId").isEmpty();
                    s.put("round", number(s.get("round")) + 1);
                    s.put("state", "IN_PROGRESS");
                    s.put(
                            "pending",
                            keep
                                    ? "ALIQUOT_TUBE"
                                    : "COLLECTION".equals(s.get("stage")) ? "CHIP" : "SOURCE_TUBE");
                    for (String key : List.of("targetTubeId", "chipContent", "mappingSnapshot"))
                        s.remove(key);
                    if (!keep)
                        for (String key : List.of("animalNo", "sourceTubeId", "sourceSnapshot"))
                            s.remove(key);
                    r.save("session", s);
                    audit.append(
                            number(s.get("projectId")), "NEXT_ROUND", "CHANGE", Map.of("after", s));
                    return s;
                });
    }

    public Map<String, Object> close(String id, Map<String, Object> b) {
        get(id);
        return r.mutate(
                "session.close." + id,
                b,
                () -> {
                    var s = r.lock("session", id);
                    owner(s);
                    authoritative(s);
                    if (!"FAILED".equals(s.get("state")))
                        throw BusinessException.conflict("仅失败轮可异常结束");
                    String reason = required(b, "remark");
                    if (!yes(b, "confirmed")) throw BusinessException.badRequest("需明确确认异常结束");
                    var event =
                            audit.append(
                                    number(s.get("projectId")),
                                    "EXCEPTION_CLOSE",
                                    "ABORT",
                                    Map.of(
                                            "sessionId",
                                            id,
                                            "stage",
                                            s.get("stage"),
                                            "expected",
                                            r.copy(s),
                                            "remark",
                                            reason,
                                            "sourceTubeId",
                                            str(s, "sourceTubeId"),
                                            "targetTubeId",
                                            str(s, "targetTubeId")));
                    s.put("state", "ABORTED");
                    s.put("pending", "NONE");
                    s.put("lastResult", event);
                    r.save("session", s);
                    return s;
                });
    }
}
