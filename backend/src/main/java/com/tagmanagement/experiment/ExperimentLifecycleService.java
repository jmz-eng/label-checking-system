package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.*;
import com.tagmanagement.common.BusinessException;
import com.tagmanagement.security.CurrentUserContext;
import org.springframework.stereotype.Service;
import java.util.*;

/** Reversible retirement; attachments and immutable archives are never deleted. */
@Service
public class ExperimentLifecycleService {
    private final ExperimentRepository r;
    private final ExperimentAuditService audit;

    public ExperimentLifecycleService(ExperimentRepository r, ExperimentAuditService audit) {
        this.r = r;
        this.audit = audit;
    }

    public static void requireAdmin() {
        var user = CurrentUserContext.get();
        if (user == null || user.getRoles() == null || !user.getRoles().contains("ADMIN"))
            throw BusinessException.forbidden("仅系统管理员可以删除、恢复或查看已删除实验");
    }

    public Map<String, Object> change(long p, Map<String, Object> body, boolean restore) {
        requireAdmin();
        return r.mutate("project." + (restore ? "restore." : "delete.") + p, body, () -> {
            r.lockProjectForLifecycle(p);
            var before = r.project(p);
            String reason = required(body, "reason");
            if (!yes(body, "confirmed")) throw BusinessException.badRequest("请明确确认实验操作");
            boolean deleted = "DELETED".equals(before.get("status"));
            if (restore != deleted) throw BusinessException.conflict(restore ? "实验尚未删除" : "实验已删除，请刷新列表");
            if (!restore && r.list("session", p).stream().anyMatch(s ->
                    Set.of("IN_PROGRESS", "FAILED").contains(str(s, "state"))))
                throw BusinessException.conflict("实验有人正在核对或有未处理失败轮次，请先完成核对后再删除");
            // Printing retains its existing tube-level concurrency. Deletion alone locks
            // all of this project's tubes before changing the lifecycle status.
            if (!restore) r.list("tube", p).stream().map(t -> str(t, "id")).sorted()
                    .forEach(id -> r.lock("tube", id));
            String status = "DELETED";
            if (restore) {
                status = r.list("event", p).stream()
                        .filter(e -> "PROJECT_DELETE".equals(e.get("action")))
                        .reduce((a, b) -> b)
                        .map(e -> str(r.decode(r.encode(e.get("before"))), "status"))
                        .filter(s -> !s.isBlank() && !s.equals("DELETED"))
                        .orElse("ACTIVE");
            }
            r.jdbc().update("UPDATE project_info SET status=? WHERE id=?", status, p);
            var after = r.project(p);
            audit.append(p, restore ? "PROJECT_RESTORE" : "PROJECT_DELETE", "CHANGE",
                    fields("before", before, "after", after, "reason", reason));
            return after;
        });
    }
}
