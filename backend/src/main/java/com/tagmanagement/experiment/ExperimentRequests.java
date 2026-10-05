package com.tagmanagement.experiment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Map;

/** HTTP scan inputs intentionally contain neither actor identity nor a client-selected result. */
public final class ExperimentRequests {
    private ExperimentRequests() {}

    public record Scan(
            @NotBlank @Size(max = 128) String requestId,
            @NotBlank @Size(max = 2000) String content) {
        public Map<String, Object> body() {
            return Map.of("requestId", requestId, "content", content);
        }
    }

    public record Start(
            @NotBlank @Size(max = 128) String requestId,
            @NotNull @Pattern(regexp = "COLLECTION|ALIQUOT") String stage,
            @NotBlank String collectDate,
            @NotBlank @Size(max = 2000) String timePoint,
            @NotBlank String purposeId) {
        public Map<String, Object> body() {
            return Map.of(
                    "requestId",
                    requestId,
                    "stage",
                    stage,
                    "collectDate",
                    collectDate,
                    "timePoint",
                    timePoint,
                    "purposeId",
                    purposeId);
        }
    }

    public record Next(@NotBlank @Size(max = 128) String requestId, boolean retainSource) {
        public Map<String, Object> body() {
            return Map.of("requestId", requestId, "retainSource", retainSource);
        }
    }

    public record Close(
            @NotBlank @Size(max = 128) String requestId,
            @NotBlank @Size(max = 2000) String remark,
            boolean confirmed) {
        public Map<String, Object> body() {
            return Map.of("requestId", requestId, "remark", remark, "confirmed", confirmed);
        }
    }
}
