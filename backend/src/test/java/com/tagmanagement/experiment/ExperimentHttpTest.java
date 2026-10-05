package com.tagmanagement.experiment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.*;

import org.junit.jupiter.api.*;

class ExperimentHttpTest extends ExperimentTestSupport {
    @Test
    void simplifiedProjectHttpContract() throws Exception {
        mvc.perform(
                        post("/api/experiments")
                                .header("Authorization", "Bearer " + token)
                                .contentType("application/json")
                                .content(
                                        "{\"requestId\":\"create-project\",\"projectCode\":\"HTTP-001\",\"projectName\":\"试验\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.projectCode").value("HTTP-001"));
    }

    @Test
    void routesRequireAuthentication() throws Exception {
        mvc.perform(get("/api/experiments")).andExpect(status().isUnauthorized());
    }
}
