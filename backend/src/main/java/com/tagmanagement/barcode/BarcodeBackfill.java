package com.tagmanagement.barcode;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Runs after additive SQL initialization and before normal requests/demo bootstrap. */
@Component
@Order(-100)
public class BarcodeBackfill implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    private final BarcodeRegistry registry;

    public BarcodeBackfill(JdbcTemplate jdbc, BarcodeRegistry registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    @Override
    public void run(ApplicationArguments args) {
        String last = "";
        while (true) {
            var ids =
                    jdbc.query(
                            "SELECT id FROM exp_tube WHERE id>? ORDER BY id LIMIT 1000",
                            (r, n) -> r.getString(1),
                            last);
            if (ids.isEmpty()) break;
            for (String id : ids) registry.allocate("TUBE", id);
            last = ids.get(ids.size() - 1);
        }
        long lastTask = 0;
        while (true) {
            var ids =
                    jdbc.query(
                            "SELECT id FROM sample_task WHERE id>? ORDER BY id LIMIT 1000",
                            (r, n) -> r.getLong(1),
                            lastTask);
            if (ids.isEmpty()) break;
            for (long id : ids) registry.allocate("SAMPLE_TASK", Long.toString(id));
            lastTask = ids.get(ids.size() - 1);
        }
    }
}
