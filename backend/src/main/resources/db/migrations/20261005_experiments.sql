-- Additive schema; existing samples and scan records are preserved. MySQL 8 / H2 MySQL mode.
CREATE TABLE IF NOT EXISTS exp_mapping (
 active_animal VARCHAR(64) NULL,
 active_chip VARCHAR(128) NULL,
 UNIQUE (project_id,active_animal),
 UNIQUE (project_id,active_chip),
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_mapping_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_purpose (
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_purpose_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_tube (
 code VARCHAR(32) NULL UNIQUE,
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_tube_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_session (
 owner_id BIGINT NULL,
 INDEX exp_session_owner (owner_id),
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_session_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_event (
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_event_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_import (
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_import_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_print (
 id VARCHAR(32) PRIMARY KEY,
 project_id BIGINT NOT NULL,
 payload LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX exp_print_project (project_id)
);
CREATE TABLE IF NOT EXISTS exp_request (
 actor_id BIGINT NOT NULL, request_id VARCHAR(128) NOT NULL,
 fingerprint VARCHAR(64) NOT NULL, response LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (actor_id,request_id)
);
CREATE TABLE IF NOT EXISTS exp_import_file (
 import_id VARCHAR(32) PRIMARY KEY, file_bytes LONGBLOB NOT NULL
);
INSERT INTO sys_menu (parent_id,menu_key,menu_name,route_path,component,permission_code,icon,sort_order,visible,status)
SELECT 0,'experiments','实验列表','/experiments','ExperimentsPage','project:view','ExperimentOutlined',5,1,'ENABLED'
WHERE NOT EXISTS (SELECT 1 FROM sys_menu WHERE menu_key='experiments');
