package com.tagmanagement.barcode;

import com.tagmanagement.common.BusinessException;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Locale;

/** Persistent identity only: never derives aliases from business text or rewrites archives. */
@Service
public class BarcodeRegistry {
    private static final long MAX_ALIAS = 999_999_999_999L;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;

    public BarcodeRegistry(JdbcTemplate jdbc, PlatformTransactionManager manager) {
        this.jdbc = jdbc;
        tx = new TransactionTemplate(manager);
        // New identities allocate in the caller's creation transaction. Existing identities
        // are backfilled before requests; live tube reads only look up committed aliases.
        // No nested connection is needed, even with more operators than pool connections.
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRED);
        tx.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    public String allocate(String namespace, String entityId) {
        validateNamespace(namespace);
        if (entityId == null || entityId.isBlank() || entityId.length() > 64)
            throw new IllegalArgumentException("entityId");
        return tx.execute(
                status -> {
                    var ids = ids(namespace, entityId);
                    if (ids.isEmpty()) {
                        // MySQL and H2 MySQL mode: concurrent losers wait on the unique pair and
                        // keep the winner's sequence. Gaps are harmless; aliases are never
                        // recycled.
                        jdbc.update(
                                "INSERT INTO label_barcode(namespace,entity_id) VALUES (?,?)"
                                        + " ON DUPLICATE KEY UPDATE entity_id=VALUES(entity_id)",
                                namespace,
                                entityId);
                        // Locking/current read is required after a conflicting upsert when the
                        // caller uses MySQL REPEATABLE READ and already established a snapshot.
                        ids =
                                jdbc.query(
                                        "SELECT id FROM label_barcode WHERE namespace=? AND"
                                            + " entity_id=? FOR UPDATE",
                                        (r, n) -> r.getLong(1),
                                        namespace,
                                        entityId);
                    }
                    return format(ids.get(0));
                });
    }

    public String existing(String namespace, String entityId) {
        validateNamespace(namespace);
        var ids = ids(namespace, entityId);
        if (ids.isEmpty()) throw BusinessException.conflict("该管子缺少持久化条形码，不能打印或核对，请重新启动系统完成旧数据登记");
        return format(ids.get(0));
    }

    private String format(long sequence) {
        if (sequence < 1 || sequence > MAX_ALIAS)
            throw BusinessException.conflict("12位条形码容量已用尽，不能生成或打印标签");
        return String.format(Locale.ROOT, "%012d", sequence);
    }

    public String resolve(String namespace, String content) {
        validateNamespace(namespace);
        if (content == null || !content.matches("[0-9]{12}")) return null;
        var rows =
                jdbc.query(
                        "SELECT entity_id FROM label_barcode WHERE namespace=? AND id=?",
                        (r, n) -> r.getString(1),
                        namespace,
                        Long.parseLong(content));
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Long> ids(String namespace, String entityId) {
        return jdbc.query(
                "SELECT id FROM label_barcode WHERE namespace=? AND entity_id=?",
                (r, n) -> r.getLong(1),
                namespace,
                entityId);
    }

    private static void validateNamespace(String namespace) {
        if (!List.of("TUBE", "SAMPLE_TASK").contains(namespace))
            throw new IllegalArgumentException("namespace");
    }
}
