package com.tagmanagement.experiment;

import com.tagmanagement.security.CurrentUserContext;

import org.springframework.stereotype.Service;

import java.util.*;

/** Builds immutable server-attributed snapshots. There is no update/delete archive operation. */
@Service
public class ExperimentAuditService {
    private final ExperimentRepository repository;

    public ExperimentAuditService(ExperimentRepository repository) {
        this.repository = repository;
    }

    public Map<String, Object> append(
            long p, String action, String result, Map<String, Object> details) {
        var e = new LinkedHashMap<String, Object>();
        e.put("projectId", p);
        e.put("projectSnapshot", repository.project(p));
        e.put("action", action);
        e.put("result", result);
        e.put("actorId", CurrentUserContext.get().getId());
        e.put("actorName", CurrentUserContext.get().getRealName());
        e.putAll(details);
        repository.save("event", e);
        return e;
    }
}
