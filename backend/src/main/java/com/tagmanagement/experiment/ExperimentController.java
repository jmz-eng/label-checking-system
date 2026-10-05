package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.*;

import com.tagmanagement.common.ApiResponse;
import com.tagmanagement.security.RequirePermission;

import jakarta.validation.Valid;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/experiments")
@RequirePermission("project:view")
public class ExperimentController {
    final ExperimentRepository r;
    final ExperimentDataService data;
    final ExperimentSessionService sessions;
    final ExperimentImportService imports;

    public ExperimentController(
            ExperimentRepository r,
            ExperimentDataService data,
            ExperimentSessionService sessions,
            ExperimentImportService imports) {
        this.r = r;
        this.data = data;
        this.sessions = sessions;
        this.imports = imports;
    }

    @GetMapping
    public ApiResponse<?> list() {
        return ApiResponse.ok(data.projects());
    }

    @PostMapping
    @RequirePermission("project:create")
    public ApiResponse<?> create(@RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.createProject(b));
    }

    @GetMapping("/{p}")
    public ApiResponse<?> detail(@PathVariable long p) {
        return ApiResponse.ok(r.project(p));
    }

    @GetMapping("/{p}/mappings")
    public ApiResponse<?> mappings(@PathVariable long p) {
        r.project(p);
        return ApiResponse.ok(r.list("mapping", p));
    }

    @PostMapping("/{p}/mappings")
    @RequirePermission("sample:generate")
    public ApiResponse<?> mappingAdd(@PathVariable long p, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.mapping(p, null, b, false));
    }

    @PostMapping("/{p}/mappings/{id}")
    @RequirePermission("sample:generate")
    public ApiResponse<?> mappingEdit(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.mapping(p, id, b, false));
    }

    @PostMapping("/{p}/mappings/{id}/delete")
    @RequirePermission("sample:generate")
    public ApiResponse<?> mappingDelete(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.mapping(p, id, b, true));
    }

    @GetMapping("/{p}/mappings/{id}/history")
    @RequirePermission("audit:view")
    public ApiResponse<?> mappingHistory(@PathVariable long p, @PathVariable String id) {
        r.scoped("mapping", p, id);
        return ApiResponse.ok(data.filtered("event", p, Map.of("entityId", id)));
    }

    @GetMapping("/{p}/purposes")
    public ApiResponse<?> purposes(@PathVariable long p) {
        r.project(p);
        return ApiResponse.ok(r.list("purpose", p));
    }

    @PostMapping("/{p}/purposes")
    @RequirePermission("sample:generate")
    public ApiResponse<?> purposeAdd(@PathVariable long p, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.purpose(p, null, b, false));
    }

    @PostMapping("/{p}/purposes/{id}")
    @RequirePermission("sample:generate")
    public ApiResponse<?> purposeEdit(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.purpose(p, id, b, false));
    }

    @PostMapping("/{p}/purposes/{id}/delete")
    @RequirePermission("sample:generate")
    public ApiResponse<?> purposeDelete(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.purpose(p, id, b, true));
    }

    @GetMapping("/{p}/tubes")
    public ApiResponse<?> tubes(@PathVariable long p, @RequestParam Map<String, String> filter) {
        return ApiResponse.ok(data.filtered("tube", p, filter));
    }

    @GetMapping("/{p}/tubes/{id}")
    public ApiResponse<?> tubeDetail(@PathVariable long p, @PathVariable String id) {
        return ApiResponse.ok(r.scoped("tube", p, id));
    }

    @PostMapping("/{p}/tubes")
    @RequirePermission("sample:generate")
    public ApiResponse<?> tubeAdd(@PathVariable long p, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.tube(p, null, b, "create"));
    }

    @PostMapping("/{p}/tubes/{id}")
    @RequirePermission("sample:generate")
    public ApiResponse<?> tubeEdit(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.tube(p, id, b, "edit"));
    }

    @PostMapping("/{p}/tubes/{id}/reissue")
    @RequirePermission("sample:generate")
    public ApiResponse<?> tubeReissue(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.tube(p, id, b, "reissue"));
    }

    @PostMapping("/{p}/tubes/{id}/void")
    @RequirePermission("sample:generate")
    public ApiResponse<?> tubeVoid(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.tube(p, id, b, "void"));
    }

    @PostMapping("/{p}/tube-assignments")
    @RequirePermission("sample:generate")
    public ApiResponse<?> assignments(@PathVariable long p, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.assign(p, b));
    }

    @GetMapping("/{p}/imports")
    @RequirePermission("sample:generate")
    public ApiResponse<?> batches(@PathVariable long p) {
        r.project(p);
        return ApiResponse.ok(r.list("import", p));
    }

    @GetMapping("/{p}/imports/{id}")
    @RequirePermission("sample:generate")
    public ApiResponse<?> batch(@PathVariable long p, @PathVariable String id) {
        return ApiResponse.ok(r.scoped("import", p, id));
    }

    @PostMapping(value = "/{p}/imports/preview", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @RequirePermission("sample:generate")
    public ApiResponse<?> preview(
            @PathVariable long p,
            @RequestParam String kind,
            @RequestParam String requestId,
            @RequestPart MultipartFile file) {
        return ApiResponse.ok(imports.preview(p, kind, requestId, file));
    }

    @PostMapping("/{p}/imports/{id}/commit")
    @RequirePermission("sample:generate")
    public ApiResponse<?> commit(
            @PathVariable long p, @PathVariable String id, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(imports.commit(p, id, b));
    }

    @GetMapping("/{p}/imports/{id}/original")
    @RequirePermission("sample:generate")
    public ResponseEntity<byte[]> original(@PathVariable long p, @PathVariable String id) {
        return download(
                imports.original(p, id),
                str(r.scoped("import", p, id), "fileName"),
                "application/octet-stream");
    }

    @GetMapping("/templates/{kind}")
    @RequirePermission("sample:generate")
    public ResponseEntity<byte[]> template(@PathVariable String kind) {
        return download(
                imports.template(kind),
                kind + ".xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    @GetMapping("/sessions/current")
    public ApiResponse<?> current() {
        return ApiResponse.ok(sessions.current());
    }

    @PostMapping("/{p}/sessions")
    public ApiResponse<?> start(
            @PathVariable long p, @Valid @RequestBody ExperimentRequests.Start b) {
        return ApiResponse.ok(sessions.start(p, b.body()));
    }

    @GetMapping("/sessions/{id}")
    public ApiResponse<?> session(@PathVariable String id) {
        return ApiResponse.ok(sessions.get(id));
    }

    @PostMapping("/sessions/{id}/chip")
    public ApiResponse<?> chip(
            @PathVariable String id, @Valid @RequestBody ExperimentRequests.Scan b) {
        return ApiResponse.ok(sessions.scan(id, b.body(), true));
    }

    @PostMapping("/sessions/{id}/tube")
    public ApiResponse<?> scan(
            @PathVariable String id, @Valid @RequestBody ExperimentRequests.Scan b) {
        return ApiResponse.ok(sessions.scan(id, b.body(), false));
    }

    @PostMapping("/sessions/{id}/next")
    public ApiResponse<?> next(
            @PathVariable String id, @Valid @RequestBody ExperimentRequests.Next b) {
        return ApiResponse.ok(sessions.next(id, b.body()));
    }

    @PostMapping("/sessions/{id}/exception-close")
    public ApiResponse<?> close(
            @PathVariable String id, @Valid @RequestBody ExperimentRequests.Close b) {
        return ApiResponse.ok(sessions.close(id, b.body()));
    }

    @PostMapping("/{p}/print-requests")
    @RequirePermission("label:view")
    public ApiResponse<?> print(@PathVariable long p, @RequestBody Map<String, Object> b) {
        return ApiResponse.ok(data.print(p, b));
    }

    @GetMapping("/{p}/print-requests")
    @RequirePermission("label:view")
    public ApiResponse<?> prints(@PathVariable long p) {
        r.project(p);
        return ApiResponse.ok(r.list("print", p));
    }

    @GetMapping("/{p}/records")
    @RequirePermission("record:view")
    public ApiResponse<?> records(@PathVariable long p, @RequestParam Map<String, String> filter) {
        return ApiResponse.ok(data.filtered("event", p, filter));
    }

    @GetMapping("/{p}/changes")
    @RequirePermission("audit:view")
    public ApiResponse<?> changes(@PathVariable long p, @RequestParam Map<String, String> filter) {
        var f = new HashMap<>(filter);
        f.put("result", "CHANGE");
        return ApiResponse.ok(data.filtered("event", p, f));
    }

    @GetMapping("/{p}/changes/{id}")
    @RequirePermission("audit:view")
    public ApiResponse<?> change(@PathVariable long p, @PathVariable String id) {
        var event = r.scoped("event", p, id);
        if (!"CHANGE".equals(event.get("result")))
            throw com.tagmanagement.common.BusinessException.notFound("资料更改记录不存在");
        return ApiResponse.ok(event);
    }

    @GetMapping("/{p}/changes/export")
    @RequirePermission("audit:view")
    public ResponseEntity<byte[]> exportChanges(
            @PathVariable long p, @RequestParam Map<String, String> filter) {
        var changeFilter = new HashMap<>(filter);
        changeFilter.put("result", "CHANGE");
        return exportRows(data.filtered("event", p, changeFilter));
    }

    @GetMapping("/{p}/records/{id}")
    @RequirePermission("record:view")
    public ApiResponse<?> record(@PathVariable long p, @PathVariable String id) {
        return ApiResponse.ok(r.scoped("event", p, id));
    }

    @GetMapping("/{p}/records/export")
    @RequirePermission("record:view")
    public ResponseEntity<byte[]> export(
            @PathVariable long p, @RequestParam Map<String, String> filter) {
        return exportRows(data.filtered("event", p, filter));
    }

    private ResponseEntity<byte[]> exportRows(List<Map<String, Object>> rows) {
        StringBuilder csv =
                new StringBuilder(
                        "\ufeffid,createdAt,action,result,actorName,animalNo,collectDate,timePoint,scannedContent,message,archive\r\n");
        for (var row : rows) {
            for (String k :
                    List.of(
                            "id",
                            "createdAt",
                            "action",
                            "result",
                            "actorName",
                            "animalNo",
                            "collectDate",
                            "timePoint",
                            "scannedContent",
                            "message")) csv.append(csv(str(row, k))).append(',');
            csv.append(csv(r.encode(row))).append("\r\n");
        }
        return download(
                csv.toString().getBytes(StandardCharsets.UTF_8),
                "records.csv",
                "text/csv;charset=UTF-8");
    }

    static String csv(String value) {
        String trimmed = value.stripLeading();
        if (!trimmed.isEmpty() && "=+-@".indexOf(trimmed.charAt(0)) >= 0
                || value.startsWith("\t")
                || value.startsWith("\r")
                || value.startsWith("\n")) value = "'" + value;
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    static ResponseEntity<byte[]> download(byte[] bytes, String name, String contentType) {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment()
                                .filename(name, StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .contentType(MediaType.parseMediaType(contentType))
                .body(bytes);
    }
}
