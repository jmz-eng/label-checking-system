package com.tagmanagement.barcode;

import static org.junit.jupiter.api.Assertions.*;

import com.tagmanagement.common.BusinessException;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.util.UUID;

class BarcodeRegistryTest {
    @Test
    void capacityBoundaryBlocksOverflowAndIndependentRegistryInstancesReadSameAlias() {
        var ds =
                new DriverManagerDataSource(
                        "jdbc:h2:mem:" + UUID.randomUUID() + ";MODE=MySQL;DB_CLOSE_DELAY=-1",
                        "sa",
                        "");
        var jdbc = new JdbcTemplate(ds);
        new ResourceDatabasePopulator(new ClassPathResource("db/migrations/20261007_barcodes.sql"))
                .execute(ds);
        var manager = new DataSourceTransactionManager(ds);
        var registry = new BarcodeRegistry(jdbc, manager);
        String alias = registry.allocate("TUBE", "existing");
        assertEquals(alias, new BarcodeRegistry(jdbc, manager).allocate("TUBE", "existing"));
        assertNull(registry.resolve("SAMPLE_TASK", alias));
        assertEquals("existing", registry.resolve("TUBE", alias));
        jdbc.update(
                "INSERT INTO label_barcode(id,namespace,entity_id) VALUES"
                    + " (999999999999,'TUBE','last')");
        assertEquals("999999999999", registry.allocate("TUBE", "last"));
        assertThrows(BusinessException.class, () -> registry.allocate("SAMPLE_TASK", "overflow"));
        assertEquals(
                0,
                jdbc.queryForObject(
                        "SELECT COUNT(*) FROM label_barcode WHERE entity_id='overflow'",
                        Integer.class));
    }
}
