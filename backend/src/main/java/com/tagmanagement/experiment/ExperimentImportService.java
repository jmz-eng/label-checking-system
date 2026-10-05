package com.tagmanagement.experiment;

import static com.tagmanagement.experiment.ExperimentRepository.*;

import com.tagmanagement.common.BusinessException;

import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.util.*;

@Service
public class ExperimentImportService {
    static final String[] GROUP = {"试验编号", "动物号", "芯片号"};
    static final String[] TUBES = {"试验编号", "动物号", "时间点", "管标信息", "采样日期"};
    final ExperimentRepository r;
    final ExperimentAuditService audit;
    final ExperimentDataService data;

    public ExperimentImportService(
            ExperimentRepository r, ExperimentDataService data, ExperimentAuditService audit) {
        this.r = r;
        this.audit = audit;
        this.data = data;
    }

    static void kind(String kind) {
        if (!Set.of("GROUP", "COLLECTION", "ALIQUOT").contains(kind))
            throw BusinessException.badRequest("kind须为GROUP/COLLECTION/ALIQUOT");
    }

    public Map<String, Object> preview(long p, String kind, String request, MultipartFile file) {
        kind(kind);
        if (file.isEmpty() || file.getSize() > 8 * 1024 * 1024)
            throw BusinessException.badRequest("文件应为非空且不超过8MB的xls/xlsx");
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw BusinessException.badRequest("无法读取上传文件");
        }
        String name =
                file.getOriginalFilename() == null ? "upload.xlsx" : file.getOriginalFilename();
        String hash = hash(bytes);
        return r.mutate(
                "import.preview." + p,
                fields("requestId", request, "kind", kind, "name", name, "hash", hash),
                () -> {
                    var project = r.project(p);
                    List<Map<String, Object>> rows = new ArrayList<>(), issues = new ArrayList<>();
                    Set<String> animals = new HashSet<>(), chips = new HashSet<>();
                    String[] headers = kind.equals("GROUP") ? GROUP : TUBES;
                    try (Workbook book = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
                        if (book.getNumberOfSheets() > 20)
                            throw BusinessException.badRequest("最多20个工作表");
                        int count = 0;
                        for (Sheet sheet : book) {
                            Row header = sheet.getRow(0);
                            boolean correct =
                                    header != null && header.getLastCellNum() == headers.length;
                            for (int col = 0; col < headers.length; col++)
                                if (header == null
                                        || !headers[col].equals(
                                                new DataFormatter(Locale.ROOT)
                                                        .formatCellValue(header.getCell(col)))) {
                                    issue(
                                            issues,
                                            sheet.getSheetName(),
                                            1,
                                            headers[col],
                                            "缺少或顺序错误的列");
                                    correct = false;
                                }
                            if (!correct) {
                                issue(issues, sheet.getSheetName(), 1, "表头", "必须恰好包含规定列数且顺序一致");
                                continue;
                            }
                            if (sheet.getLastRowNum() > 10000)
                                throw BusinessException.badRequest("工作表超过10000行");
                            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                                Row source = sheet.getRow(i);
                                if (source == null || empty(source)) continue;
                                if (++count > 10000)
                                    throw BusinessException.badRequest("每次导入最多10000行");
                                var row = new LinkedHashMap<String, Object>();
                                row.putAll(
                                        fields(
                                                "rowKey",
                                                sheet.getSheetName() + ":" + (i + 1),
                                                "sourceSheet",
                                                sheet.getSheetName(),
                                                "sourceRow",
                                                i + 1,
                                                "projectId",
                                                p));
                                String[] keys =
                                        kind.equals("GROUP")
                                                ? new String[] {"projectCode", "animalNo", "chipNo"}
                                                : new String[] {
                                                    "projectCode",
                                                    "animalNo",
                                                    "timePoint",
                                                    "labelInfo",
                                                    "collectDate"
                                                };
                                if (source.getLastCellNum() > headers.length)
                                    issue(issues, sheet.getSheetName(), i + 1, "列数", "数据行存在额外列");
                                for (int col = 0; col < headers.length; col++) {
                                    Cell cell = source.getCell(col);
                                    String value =
                                            cell(
                                                    cell,
                                                    keys[col],
                                                    issues,
                                                    sheet.getSheetName(),
                                                    i + 1,
                                                    headers[col]);
                                    row.put(keys[col], value);
                                    if (value.isBlank())
                                        issue(
                                                issues,
                                                sheet.getSheetName(),
                                                i + 1,
                                                headers[col],
                                                "必填");
                                }
                                if (!str(project, "projectCode").equals(str(row, "projectCode")))
                                    issue(
                                            issues,
                                            sheet.getSheetName(),
                                            i + 1,
                                            headers[0],
                                            "试验编号与当前实验不一致");
                                if (kind.equals("GROUP")) {
                                    if (!animals.add(str(row, "animalNo"))
                                            || !chips.add(str(row, "chipNo")))
                                        issue(
                                                issues,
                                                sheet.getSheetName(),
                                                i + 1,
                                                "动物号/芯片号",
                                                "本附件存在重复对应关系");
                                    for (var m : r.list("mapping", p))
                                        if (yes(m, "active")
                                                && (str(m, "animalNo").equals(str(row, "animalNo"))
                                                        || str(m, "chipNo")
                                                                .equals(str(row, "chipNo"))))
                                            issue(
                                                    issues,
                                                    sheet.getSheetName(),
                                                    i + 1,
                                                    "动物号/芯片号",
                                                    "已存在有效对应关系，请使用资料编辑更正");
                                } else {
                                    try {
                                        data.animal(p, str(row, "animalNo"));
                                    } catch (BusinessException e) {
                                        issue(
                                                issues,
                                                sheet.getSheetName(),
                                                i + 1,
                                                "动物号",
                                                e.getMessage());
                                    }
                                    try {
                                        ExperimentDataService.date(str(row, "collectDate"));
                                    } catch (BusinessException e) {
                                        issue(
                                                issues,
                                                sheet.getSheetName(),
                                                i + 1,
                                                "采样日期",
                                                e.getMessage());
                                    }
                                    String keywordKey =
                                            kind.equals("COLLECTION")
                                                    ? "collectionKeywords"
                                                    : "aliquotKeywords";
                                    var candidates =
                                            r.list("purpose", p).stream()
                                                    .filter(
                                                            u ->
                                                                    yes(u, "active")
                                                                            && yes(u, "confirmed")
                                                                            && u.get(keywordKey)
                                                                                    instanceof
                                                                                    List<?> words
                                                                            && words.stream()
                                                                                    .anyMatch(
                                                                                            word ->
                                                                                                    str(
                                                                                                                    row,
                                                                                                                    "labelInfo")
                                                                                                            .contains(
                                                                                                                    word
                                                                                                                            .toString())))
                                                    .toList();
                                    row.put(
                                            "suggestedPurposeId",
                                            candidates.size() == 1
                                                    ? candidates.get(0).get("id")
                                                    : "");
                                    row.put("requiresConfirmation", true);
                                    row.put("kind", kind);
                                }
                                rows.add(row);
                            }
                        }
                    } catch (BusinessException e) {
                        throw e;
                    } catch (Exception e) {
                        issue(issues, "", 0, "文件", "不能解析为有效的Excel工作簿");
                    }
                    if (rows.isEmpty() && issues.isEmpty()) issue(issues, "", 0, "文件", "没有可导入数据");
                    boolean duplicate =
                            r.list("import", p).stream().anyMatch(i -> hash.equals(i.get("hash")));
                    var batch = new LinkedHashMap<String, Object>();
                    batch.putAll(
                            fields(
                                    "projectId",
                                    p,
                                    "kind",
                                    kind,
                                    "fileName",
                                    name,
                                    "hash",
                                    hash,
                                    "size",
                                    bytes.length,
                                    "status",
                                    issues.isEmpty() ? "PREVIEW" : "INVALID",
                                    "duplicate",
                                    duplicate,
                                    "rows",
                                    rows,
                                    "issues",
                                    issues));
                    r.save("import", batch);
                    r.jdbc()
                            .update(
                                    "INSERT INTO exp_import_file(import_id,file_bytes) VALUES"
                                            + " (?,?)",
                                    batch.get("id"),
                                    bytes);
                    audit.append(
                            p,
                            "IMPORT_PREVIEW",
                            "CHANGE",
                            Map.of(
                                    "importId",
                                    batch.get("id"),
                                    "hash",
                                    hash,
                                    "fileName",
                                    name,
                                    "issueCount",
                                    issues.size()));
                    return batch;
                });
    }

    static boolean empty(Row row) {
        for (Cell c : row)
            if (c.getCellType() != CellType.BLANK
                    && !new DataFormatter().formatCellValue(c).isBlank()) return false;
        return true;
    }

    String cell(
            Cell cell,
            String key,
            List<Map<String, Object>> issues,
            String sheet,
            int row,
            String col) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.FORMULA || cell.getCellType() == CellType.ERROR) {
            issue(issues, sheet, row, col, "不接受公式或错误单元格，请粘贴为原始文本/日期");
            return "";
        }
        if (key.equals("collectDate")
                && cell.getCellType() == CellType.NUMERIC
                && DateUtil.isCellDateFormatted(cell))
            return cell.getLocalDateTimeCellValue().toLocalDate().toString();
        if (Set.of("animalNo", "chipNo", "projectCode").contains(key)
                && cell.getCellType() == CellType.NUMERIC) {
            double n = cell.getNumericCellValue();
            if (n != Math.rint(n)
                    || Math.abs(n) >= 1e15
                    || cell.getCellStyle()
                            .getDataFormatString()
                            .toUpperCase(Locale.ROOT)
                            .contains("E")) {
                issue(issues, sheet, row, col, "标识数字可能丢失精度或前导零，请用文本保存");
            }
        }
        return new DataFormatter(Locale.ROOT).formatCellValue(cell);
    }

    static void issue(
            List<Map<String, Object>> issues, String sheet, int row, String col, String message) {
        issues.add(Map.of("sheet", sheet, "row", row, "column", col, "message", message));
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> commit(long p, String id, Map<String, Object> b) {
        return r.mutate(
                "import.commit." + p + "." + id,
                b,
                () -> {
                    r.lockProject(p);
                    var batch = r.scoped("import", p, id);
                    if ("COMMITTED".equals(batch.get("status")))
                        throw BusinessException.conflict("批次已提交");
                    if (!yes(b, "confirmed")) throw BusinessException.badRequest("需确认用途及配对");
                    if (yes(batch, "duplicate") && !yes(b, "acknowledgeDuplicate"))
                        throw BusinessException.conflict("重复文件须明确确认追加");
                    List<Map<String, Object>> issues =
                            new ArrayList<>((List<Map<String, Object>>) batch.get("issues"));
                    if (!issues.isEmpty()) throw BusinessException.badRequest("附件仍有错误，须修正后重新上传");
                    Map<String, Map<String, Object>> assignments = new HashMap<>();
                    Object supplied = b.getOrDefault("assignments", List.of());
                    if (!(supplied instanceof List<?> list))
                        throw BusinessException.badRequest("assignments格式错误");
                    for (Object a : list) {
                        if (!(a instanceof Map<?, ?>))
                            throw BusinessException.badRequest("assignments格式错误");
                        var m = (Map<String, Object>) a;
                        assignments.put(required(m, "rowKey"), m);
                    }
                    List<Map<String, Object>> rows = new ArrayList<>();
                    String kind = str(batch, "kind");
                    for (var original : (List<Map<String, Object>>) batch.get("rows")) {
                        var row = r.copy(original);
                        String sheet = str(row, "sourceSheet");
                        int index = (int) number(row.get("sourceRow"));
                        try {
                            if (kind.equals("GROUP")) {
                                for (var m : r.list("mapping", p))
                                    if (yes(m, "active")
                                            && (str(m, "animalNo").equals(str(row, "animalNo"))
                                                    || str(m, "chipNo").equals(str(row, "chipNo"))))
                                        throw BusinessException.conflict("对应关系已存在");
                            } else {
                                data.animal(p, required(row, "animalNo"));
                                var a = assignments.getOrDefault(str(row, "rowKey"), Map.of());
                                String purpose =
                                        a.containsKey("purposeId")
                                                ? str(a, "purposeId")
                                                : str(row, "suggestedPurposeId");
                                if (purpose.isBlank())
                                    throw BusinessException.badRequest("无法确定用途，须明确指定purposeId");
                                data.activePurpose(p, purpose);
                                row.put("purposeId", purpose);
                                row.put("confirmed", true);
                                row.put("importId", id);
                                if (kind.equals("ALIQUOT")) {
                                    String source = str(a, "sourceTubeId");
                                    if (source.isBlank()) {
                                        var candidates =
                                                r.list("tube", p).stream()
                                                        .filter(
                                                                t ->
                                                                        "COLLECTION"
                                                                                        .equals(
                                                                                                t
                                                                                                        .get(
                                                                                                                "kind"))
                                                                                && data.eligible(t)
                                                                                && ExperimentDataService
                                                                                        .tuple(
                                                                                                row,
                                                                                                t))
                                                        .toList();
                                        if (candidates.size() != 1)
                                            throw BusinessException.badRequest(
                                                    "来源采血管不唯一，须明确选择sourceTubeId");
                                        source = str(candidates.get(0), "id");
                                    }
                                    data.validateSource(p, row, source);
                                    row.put("sourceTubeId", source);
                                }
                            }
                        } catch (BusinessException e) {
                            issue(issues, sheet, index, "确认", e.getMessage());
                        }
                        rows.add(row);
                    }
                    if (!issues.isEmpty()) {
                        batch.put("status", "REJECTED");
                        batch.put("commitIssues", issues);
                        r.save("import", batch);
                        audit.append(
                                p,
                                "IMPORT_REJECTED",
                                "CHANGE",
                                Map.of("importId", id, "issues", issues));
                        return batch;
                    }
                    List<String> ids = new ArrayList<>();
                    for (var row : rows) {
                        var saved =
                                kind.equals("GROUP")
                                        ? data.writeMapping(p, null, row, false)
                                        : data.writeTube(p, null, row, "create");
                        ids.add(str(saved, "id"));
                    }
                    batch.put("status", "COMMITTED");
                    batch.put("entityIds", ids);
                    batch.put("confirmedRows", rows);
                    batch.put("commitIssues", List.of());
                    r.save("import", batch);
                    audit.append(
                            p,
                            "IMPORT_COMMIT",
                            "CHANGE",
                            Map.of(
                                    "importId",
                                    id,
                                    "count",
                                    ids.size(),
                                    "acknowledgeDuplicate",
                                    yes(b, "acknowledgeDuplicate")));
                    return batch;
                });
    }

    public byte[] original(long p, String id) {
        r.scoped("import", p, id);
        return r.jdbc()
                .queryForObject(
                        "SELECT file_bytes FROM exp_import_file WHERE import_id=?",
                        byte[].class,
                        id);
    }

    public byte[] template(String kind) {
        kind(kind);
        try (var book = new XSSFWorkbook();
                var bytes = new ByteArrayOutputStream()) {
            var sheet = book.createSheet("导入模板");
            var row = sheet.createRow(0);
            String[] names = kind.equals("GROUP") ? GROUP : TUBES;
            var text = book.createCellStyle();
            text.setDataFormat(book.createDataFormat().getFormat("@"));
            for (int i = 0; i < names.length; i++) {
                row.createCell(i).setCellValue(names[i]);
                sheet.setDefaultColumnStyle(i, text);
                sheet.setColumnWidth(i, i == 3 ? 14000 : 6000);
            }
            book.write(bytes);
            return bytes.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
