package com.tagmanagement.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class WorkbenchSummaryResponse {

    private long totalTasks;
    private long checkedTasks;
    private long passedTasks;
    private long failedRecords;
    private long pendingTasks;
    private long traceRecords;
    private BigDecimal checkedRate;
    private BigDecimal passedRate;
    private BigDecimal exceptionRate;
    private BigDecimal pendingRate;

    public static BigDecimal rate(long value, long total) {
        if (total <= 0) {
            return BigDecimal.ZERO;
        }
        return BigDecimal.valueOf(value)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
    }
}
