package com.tagmanagement.experiment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;
import com.tagmanagement.entity.SysUser;
import com.tagmanagement.security.TokenService;

import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.*;

@SpringBootTest(
        properties = {
            "spring.datasource.url=jdbc:h2:mem:experiments;MODE=MySQL;DB_CLOSE_DELAY=-1;DATABASE_TO_LOWER=TRUE",
            "spring.datasource.driver-class-name=org.h2.Driver",
            "spring.datasource.username=sa",
            "spring.datasource.password=",
            "spring.sql.init.schema-locations=classpath:legacy-h2-schema.sql",
            "app.jwt-secret=integration-test-secret-not-for-production-123456",
            "app.bootstrap-enabled=false"
        })
@AutoConfigureMockMvc
abstract class ExperimentTestSupport {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired TokenService tokens;
    @Autowired ObjectMapper json;
    String token;

    @BeforeEach
    void user() {
        jdbc.update(
                "MERGE INTO sys_user (id,username,password_hash,real_name,status) KEY(id) VALUES"
                        + " (991,'integration','unused','测试员','ENABLED')");
        jdbc.update(
                "MERGE INTO sys_role (id,role_code,role_name) KEY(id) VALUES (991,'ADMIN','管理员')");
        jdbc.update("MERGE INTO sys_user_role (id,user_id,role_id) KEY(id) VALUES (991,991,991)");
        jdbc.update(
                "MERGE INTO sys_permission (id,permission_code,permission_name,module) KEY(id)"
                        + " VALUES (991,'*','all','test')");
        jdbc.update(
                "MERGE INTO sys_role_permission (id,role_id,permission_id) KEY(id) VALUES"
                        + " (991,991,991)");
        SysUser u = new SysUser();
        u.setId(991L);
        u.setUsername("integration");
        token = tokens.createToken(u);
    }

    JsonNode call(String path, Map<String, Object> body) throws Exception {
        body = new LinkedHashMap<>(body);
        body.putIfAbsent("requestId", UUID.randomUUID().toString());
        String raw =
                mvc.perform(
                                post("/api/experiments" + path)
                                        .header("Authorization", "Bearer " + token)
                                        .contentType("application/json")
                                        .content(json.writeValueAsBytes(body)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return json.readTree(raw).path("data");
    }

    JsonNode read(String path) throws Exception {
        return json.readTree(
                        mvc.perform(
                                        get("/api/experiments" + path)
                                                .header("Authorization", "Bearer " + token))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString())
                .path("data");
    }

    String project() throws Exception {
        return call("", Map.of("projectCode", "P" + UUID.randomUUID(), "projectName", "实验"))
                .path("id")
                .asText();
    }

    String purpose(String p) throws Exception {
        return call(
                        "/" + p + "/purposes",
                        Map.of(
                                "name",
                                "PK",
                                "collectionKeywords",
                                List.of("原血"),
                                "aliquotKeywords",
                                List.of("血浆"),
                                "confirmed",
                                true))
                .path("id")
                .asText();
    }

    void mapping(String p) throws Exception {
        call("/" + p + "/mappings", Map.of("animalNo", "001", "chipNo", "000123"));
    }

    JsonNode tube(String p, String purpose, String kind, String parent, String date)
            throws Exception {
        var b =
                new LinkedHashMap<String, Object>(
                        Map.of(
                                "animalNo",
                                "001",
                                "timePoint",
                                "1h",
                                "collectDate",
                                date,
                                "labelInfo",
                                "原样文字",
                                "kind",
                                kind,
                                "purposeId",
                                purpose,
                                "confirmed",
                                true));
        if (parent != null) b.put("sourceTubeId", parent);
        return call("/" + p + "/tubes", b);
    }

    JsonNode start(String p, String purpose, String stage) throws Exception {
        return call(
                "/" + p + "/sessions",
                Map.of(
                        "stage",
                        stage,
                        "collectDate",
                        "2026-10-05",
                        "timePoint",
                        "1h",
                        "purposeId",
                        purpose));
    }
}
