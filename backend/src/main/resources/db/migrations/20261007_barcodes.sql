-- Dedicated immutable identity registry. Shared sequence across all printing channels.
-- No update of tube payloads, prior events, prints or request archives.
CREATE TABLE IF NOT EXISTS label_barcode (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  namespace VARCHAR(20) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  UNIQUE (namespace, entity_id)
);
