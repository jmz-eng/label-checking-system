package com.tagmanagement.experiment;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tagmanagement.barcode.BarcodeRegistry;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

class BarcodeListConnectionTest {
    @Test
    void tenNontransactionalListsCompleteWithDefaultTenConnectionPool() throws Exception {
        try (var ds = database()) {
            assertEquals(10, ds.getMaximumPoolSize());
            var jdbc = new JdbcTemplate(ds);
            var manager = new DataSourceTransactionManager(ds);
            String alias = new BarcodeRegistry(jdbc, manager).allocate("TUBE", "t1");
            var activeAtLookup = new AtomicInteger(-1);
            // Force all requests to enter alias lookup together, as in the reviewer probe.
            var barrier = new CyclicBarrier(10,
                    () -> activeAtLookup.set(ds.getHikariPoolMXBean().getActiveConnections()));
            var registry = new BarcodeRegistry(jdbc, manager) {
                @Override
                public String existing(String namespace, String entityId) {
                    try {
                        barrier.await(5, TimeUnit.SECONDS);
                    } catch (Exception e) {
                        throw new IllegalStateException(e);
                    }
                    return super.existing(namespace, entityId);
                }
            };
            var repository = new ExperimentRepository(jdbc, new ObjectMapper(), manager, registry);
            var pool = Executors.newFixedThreadPool(10);
            try {
                var jobs = new ArrayList<Future<List<Map<String, Object>>>>();
                for (int i = 0; i < 10; i++) jobs.add(pool.submit(() -> repository.list("tube", 1)));
                var failures = new ArrayList<Throwable>();
                for (var job : jobs) {
                    try {
                        var rows = job.get(10, TimeUnit.SECONDS);
                        assertEquals(1, rows.size());
                        assertEquals(alias, rows.get(0).get("barcode"));
                    } catch (ExecutionException e) {
                        failures.add(e.getCause());
                    }
                }
                assertTrue(failures.isEmpty(), "List connection failures: " + failures.size()
                        + "/10; active at alias lookup=" + activeAtLookup.get() + "; " + failures);
                assertEquals(0, activeAtLookup.get(), "Outer list connections must be released");
            } finally {
                pool.shutdownNow();
            }
        }
    }

    @Test
    void listEnrichmentKeepsTransactionBoundTubeLockUntilCommit() throws Exception {
        try (var ds = database()) {
            var jdbc = new JdbcTemplate(ds);
            var manager = new DataSourceTransactionManager(ds);
            var registry = new BarcodeRegistry(jdbc, manager);
            registry.allocate("TUBE", "t1");
            var repository = new ExperimentRepository(jdbc, new ObjectMapper(), manager, registry);
            var pool = Executors.newSingleThreadExecutor();
            try {
                var attempted = new CountDownLatch(1);
                var contender = new ArrayList<Future<Map<String, Object>>>();
                new TransactionTemplate(manager).executeWithoutResult(status -> {
                    repository.lock("tube", "t1");
                    assertEquals(1, repository.list("tube", 1).size());
                    assertEquals(1, ds.getHikariPoolMXBean().getActiveConnections());
                    contender.add(pool.submit(() -> new TransactionTemplate(manager).execute(s -> {
                        attempted.countDown();
                        return repository.lock("tube", "t1");
                    })));
                    assertDoesNotThrow(() -> assertTrue(attempted.await(5, TimeUnit.SECONDS)));
                    assertThrows(TimeoutException.class,
                            () -> contender.get(0).get(200, TimeUnit.MILLISECONDS));
                });
                assertEquals("t1", contender.get(0).get(5, TimeUnit.SECONDS).get("id"));
            } finally {
                pool.shutdownNow();
            }
        }
    }

    private HikariDataSource database() {
        var config = new HikariConfig();
        config.setJdbcUrl("jdbc:h2:mem:list-" + UUID.randomUUID() + ";MODE=MySQL");
        config.setConnectionTimeout(1000);
        var ds = new HikariDataSource(config);
        var jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE TABLE exp_tube(id VARCHAR(64) PRIMARY KEY, project_id BIGINT,"
                + " payload VARCHAR(1000), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
        jdbc.execute("CREATE TABLE label_barcode(id BIGINT PRIMARY KEY AUTO_INCREMENT,"
                + " namespace VARCHAR(20), entity_id VARCHAR(64), UNIQUE(namespace,entity_id))");
        jdbc.update("INSERT INTO exp_tube(id,project_id,payload) VALUES ('t1',1,?)",
                "{\"id\":\"t1\",\"projectId\":1,\"code\":\"original-code\"}");
        return ds;
    }
}
