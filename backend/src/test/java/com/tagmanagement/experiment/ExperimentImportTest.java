package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.ByteArrayOutputStream;
import java.util.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

class ExperimentImportTest extends ExperimentTestSupport {

  @Test
  void commonDateTextNormalizesAndAliquotFindsCollectionSource() throws Exception {
    String p = project(), u = purpose(p), code = read("/" + p).path("projectCode").asText();
    mapping(p);
    for (String date : List.of("2026.08.20", "2026/8/20", "2026-8-20", " 2026-08-20 ")) {
      var preview =
          upload(
              p,
              excel(ExperimentImportService.TUBES, new String[] {code, "001", "1h", "原血", date}),
              "COLLECTION");
      assertEquals("PREVIEW", preview.path("status").asText(), preview.path("issues").toString());
      assertEquals("2026-08-20", preview.path("rows").get(0).path("collectDate").asText());
    }
    var source =
        upload(
            p,
            excel(
                ExperimentImportService.TUBES,
                new String[] {code, "001", "1h", "原血", "2026.08.20"}),
            "COLLECTION");
    var committed =
        call(
            "/" + p + "/imports/" + source.path("id").asText() + "/commit",
            Map.of("confirmed", true, "acknowledgeDuplicate", true));
    assertEquals("COMMITTED", committed.path("status").asText());
    var target =
        upload(
            p,
            excel(
                ExperimentImportService.TUBES,
                new String[] {code, "001", "1h", "血浆-a", "2026/08/20"}),
            "ALIQUOT");
    assertEquals("PREVIEW", target.path("status").asText());
    assertEquals(
        "COMMITTED",
        call(
                "/" + p + "/imports/" + target.path("id").asText() + "/commit",
                Map.of("confirmed", true))
            .path("status")
            .asText());
    var tubes = read("/" + p + "/tubes");
    var parent =
        tubes.get(0).path("kind").asText().equals("COLLECTION") ? tubes.get(0) : tubes.get(1);
    var child = tubes.get(0).path("kind").asText().equals("ALIQUOT") ? tubes.get(0) : tubes.get(1);
    assertEquals(parent.path("id").asText(), child.path("sourceTubeId").asText());
    assertEquals(u, child.path("purposeId").asText());
    assertEquals("2026-08-20", child.path("collectDate").asText());
  }

  @Test
  void invalidAmbiguousAndMixedSeparatorDatesRemainBlocked() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    mapping(p);
    for (String date :
        List.of("2026.02.29", "2026/13/01", "08/20/2026", "2026.08/20", "20260820")) {
      var preview =
          upload(
              p,
              excel(ExperimentImportService.TUBES, new String[] {code, "001", "1h", "原血", date}),
              "COLLECTION");
      assertEquals("INVALID", preview.path("status").asText());
      assertTrue(preview.path("issues").findValuesAsText("column").contains("采样日期"));
    }
    assertEquals(0, read("/" + p + "/tubes").size());
  }

  @Test
  void mismatchedExperimentExplainsActualAndExpectedWithoutReassigning() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    var preview =
        upload(
            p,
            excel(
                ExperimentImportService.GROUP, new String[] {"OTHER-EXPERIMENT", "001", "000123"}),
            "GROUP");
    assertEquals("INVALID", preview.path("status").asText());
    String message = preview.path("issues").get(0).path("message").asText();
    assertTrue(message.contains("OTHER-EXPERIMENT"), message);
    assertTrue(message.contains(code), message);
    assertEquals("OTHER-EXPERIMENT", preview.path("rows").get(0).path("projectCode").asText());
    assertEquals(0, read("/" + p + "/mappings").size());
  }

  @Test
  void generalNumericAnimalAndFifteenDigitChipPreviewAndCommitExactly() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    byte[] bytes =
        numericGroup(
            code,
            new double[][] {{1001, 812345678901234d}, {1002, 812345678901235d}},
            new String[] {"General", "0_ "});
    var preview = upload(p, bytes, "GROUP");
    assertEquals(0, preview.path("issues").size(), preview.path("issues").toString());
    assertEquals("PREVIEW", preview.path("status").asText());
    assertEquals("1001", preview.path("rows").get(0).path("animalNo").asText());
    assertEquals("812345678901234", preview.path("rows").get(0).path("chipNo").asText());
    assertEquals(
        "COMMITTED",
        call(
                "/" + p + "/imports/" + preview.path("id").asText() + "/commit",
                Map.of("confirmed", true))
            .path("status")
            .asText());
    var mappings = read("/" + p + "/mappings");
    assertEquals(2, mappings.size());
    assertTrue(mappings.findValuesAsText("animalNo").contains("1001"));
    assertTrue(mappings.findValuesAsText("chipNo").contains("812345678901234"));
  }

  @Test
  void generalFifteenDigitNumericChipRetainsEveryDigit() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    var preview =
        upload(
            p,
            numericGroup(
                code,
                new double[][] {{1001, 812345678901234d}},
                new String[] {"General", "General"}),
            "GROUP");
    assertEquals(0, preview.path("issues").size());
    assertEquals("812345678901234", preview.path("rows").get(0).path("chipNo").asText());
    call(
        "/" + p + "/imports/" + preview.path("id").asText() + "/commit", Map.of("confirmed", true));
    assertEquals("812345678901234", read("/" + p + "/mappings").get(0).path("chipNo").asText());
  }

  @Test
  void numericPrecisionFractionAndScientificFormatsStillBlockGroupCommit() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    for (var scenario :
        List.of(
            new Object[] {1e15, "0"},
            new Object[] {123.5, "0.0"},
            new Object[] {12345d, "0.00E+00"},
            new Object[] {12345d, "0.00E-00"})) {
      byte[] bytes =
          numericGroup(
              code,
              new double[][] {{1001, (double) scenario[0]}},
              new String[] {"0", (String) scenario[1]});
      var preview = upload(p, bytes, "GROUP");
      assertEquals("INVALID", preview.path("status").asText());
      assertTrue(preview.path("issues").findValuesAsText("column").contains("芯片号"));
      mvc.perform(
              post("/api/experiments/" + p + "/imports/" + preview.path("id").asText() + "/commit")
                  .header("Authorization", "Bearer " + token)
                  .contentType("application/json")
                  .content(
                      json.writeValueAsBytes(
                          Map.of("requestId", UUID.randomUUID().toString(), "confirmed", true))))
          .andExpect(status().isBadRequest());
    }
    assertEquals(0, read("/" + p + "/mappings").size());
  }

  @Test
  void numericIdentifierExplicitLeadingZerosArePreserved() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    var preview =
        upload(
            p,
            numericGroup(
                code, new double[][] {{1, 12345}}, new String[] {"0000", "000000000000000"}),
            "GROUP");
    assertEquals(0, preview.path("issues").size());
    assertEquals("0001", preview.path("rows").get(0).path("animalNo").asText());
    assertEquals("000000000012345", preview.path("rows").get(0).path("chipNo").asText());
  }

  private byte[] numericGroup(String code, double[][] values, String[] formats) throws Exception {
    try (var book = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      var sheet = book.createSheet("导入模板");
      var header = sheet.createRow(0);
      String[] names = {"试验编号", "动物号", "芯片号"};
      for (int col = 0; col < names.length; col++) header.createCell(col).setCellValue(names[col]);
      for (int i = 0; i < values.length; i++) {
        var row = sheet.createRow(i + 1);
        row.createCell(0).setCellValue(code);
        for (int col = 0; col < 2; col++) {
          var cell = row.createCell(col + 1);
          cell.setCellValue(values[i][col]);
          var style = book.createCellStyle();
          style.setDataFormat(book.createDataFormat().getFormat(formats[col]));
          cell.setCellStyle(style);
        }
      }
      book.write(out);
      return out.toByteArray();
    }
  }

  @Test
  void realExcelGroupPreviewCommitOriginalAndDuplicate() throws Exception {
    String p = project(), code = read("/" + p).path("projectCode").asText();
    byte[] bytes =
        excel(new String[] {"试验编号", "动物号", "芯片号"}, new String[] {code, "0001", "000000012345"});
    var preview =
        json.readTree(
                mvc.perform(
                        multipart("/api/experiments/" + p + "/imports/preview")
                            .file(
                                new MockMultipartFile(
                                    "file",
                                    "group.xlsx",
                                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                                    bytes))
                            .param("kind", "GROUP")
                            .param("requestId", UUID.randomUUID().toString())
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .path("data");
    assertEquals(0, preview.path("issues").size());
    String id = preview.path("id").asText();
    assertEquals("0001", preview.path("rows").get(0).path("animalNo").asText());
    call(
        "/" + p + "/imports/" + id + "/commit",
        Map.of("confirmed", true, "acknowledgeDuplicate", false));
    assertEquals("000000012345", read("/" + p + "/mappings").get(0).path("chipNo").asText());
    byte[] original =
        mvc.perform(
                get("/api/experiments/" + p + "/imports/" + id + "/original")
                    .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsByteArray();
    assertArrayEquals(bytes, original);
  }

  @Test
  void invalidSheetReportsCellAndPreservesOriginal() throws Exception {
    String p = project();
    byte[] bytes =
        excel(
            new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
            new String[] {"WRONG", "missing", "1h", "血浆", "2026-02-30"});
    var result =
        json.readTree(
                mvc.perform(
                        multipart("/api/experiments/" + p + "/imports/preview")
                            .file(
                                new MockMultipartFile(
                                    "file", "bad.xlsx", "application/octet-stream", bytes))
                            .param("kind", "COLLECTION")
                            .param("requestId", UUID.randomUUID().toString())
                            .header("Authorization", "Bearer " + token))
                    .andExpect(status().isOk())
                    .andReturn()
                    .getResponse()
                    .getContentAsString())
            .path("data");
    assertTrue(result.path("issues").size() >= 3);
    assertEquals("样表", result.path("issues").get(0).path("sheet").asText());
    assertEquals(2, result.path("issues").get(0).path("row").asInt());
  }

  @Test
  void uncertainPurposeAndDuplicateTubeFileNeedExplicitConfirmation() throws Exception {
    String p = project(), u = purpose(p);
    mapping(p);
    String code = read("/" + p).path("projectCode").asText();
    byte[] bytes =
        excel(
            new String[] {"试验编号", "动物号", "时间点", "管标信息", "采样日期"},
            new String[] {code, "001", "1h", "无法猜测的用途", "2026-10-05"});
    String id = upload(p, bytes, "COLLECTION").path("id").asText();
    var rejected = call("/" + p + "/imports/" + id + "/commit", Map.of("confirmed", true));
    assertEquals("REJECTED", rejected.path("status").asText());
    assertEquals(0, read("/" + p + "/tubes").size());
    var assignments = List.of(Map.of("rowKey", "样表:2", "purposeId", u));
    assertEquals(
        "COMMITTED",
        call(
                "/" + p + "/imports/" + id + "/commit",
                Map.of("confirmed", true, "assignments", assignments))
            .path("status")
            .asText());
    var duplicate = upload(p, bytes, "COLLECTION");
    assertTrue(duplicate.path("duplicate").asBoolean());
    String dup = duplicate.path("id").asText();
    mvc.perform(
            post("/api/experiments/" + p + "/imports/" + dup + "/commit")
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .content(
                    json.writeValueAsBytes(
                        Map.of(
                            "requestId",
                            UUID.randomUUID().toString(),
                            "confirmed",
                            true,
                            "assignments",
                            assignments))))
        .andExpect(status().isConflict());
    assertEquals(
        "COMMITTED",
        call(
                "/" + p + "/imports/" + dup + "/commit",
                Map.of("confirmed", true, "acknowledgeDuplicate", true, "assignments", assignments))
            .path("status")
            .asText());
    assertEquals(2, read("/" + p + "/tubes").size());
  }
}
