-- Test fixture: remove MySQL engine/collation and make index names schema-unique for H2.
CREATE TABLE IF NOT EXISTS sys_user (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  real_name VARCHAR(64) NOT NULL,
  department VARCHAR(128) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_username_2 (username)
);

CREATE TABLE IF NOT EXISTS sys_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_code VARCHAR(64) NOT NULL,
  role_name VARCHAR(64) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_code_4 (role_code)
);

CREATE TABLE IF NOT EXISTS sys_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  permission_code VARCHAR(128) NOT NULL,
  permission_name VARCHAR(128) NOT NULL,
  module VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_permission_code_6 (permission_code)
);

CREATE TABLE IF NOT EXISTS sys_user_role (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role_8 (user_id, role_id),
  KEY idx_user_id_9 (user_id),
  KEY idx_role_id_10 (role_id)
);

CREATE TABLE IF NOT EXISTS sys_role_permission (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  permission_id BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_permission_12 (role_id, permission_id),
  KEY idx_role_id_13 (role_id),
  KEY idx_permission_id_14 (permission_id)
);

CREATE TABLE IF NOT EXISTS project_info (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_code VARCHAR(64) NOT NULL,
  project_name VARCHAR(128) NOT NULL,
  test_article VARCHAR(128) NOT NULL,
  sponsor VARCHAR(128) NULL,
  owner_id BIGINT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_code_16 (project_code),
  KEY idx_status_17 (status)
);

CREATE TABLE IF NOT EXISTS animal_info (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  animal_no VARCHAR(64) NOT NULL,
  group_no VARCHAR(64) NULL,
  gender VARCHAR(20) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_project_animal_19 (project_id, animal_no),
  KEY idx_project_animal_20 (project_id, animal_no)
);

CREATE TABLE IF NOT EXISTS sample_task (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  project_id BIGINT NOT NULL,
  animal_id BIGINT NOT NULL,
  label_code VARCHAR(160) NOT NULL,
  tube_no VARCHAR(64) NULL,
  sample_type VARCHAR(64) NOT NULL,
  time_point VARCHAR(64) NOT NULL,
  planned_collect_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PRINTED',
  bound_by BIGINT NULL,
  bound_at DATETIME NULL,
  verified_by BIGINT NULL,
  verified_at DATETIME NULL,
  recorded_by BIGINT NULL,
  recorded_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_label_code_22 (label_code),
  KEY idx_project_status_23 (project_id, status),
  KEY idx_animal_timepoint_24 (animal_id, time_point)
);

CREATE TABLE IF NOT EXISTS scan_record (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  task_id BIGINT NULL,
  label_code VARCHAR(160) NOT NULL,
  action_type VARCHAR(30) NOT NULL,
  expected_summary VARCHAR(512) NULL,
  scanned_payload VARCHAR(512) NULL,
  result VARCHAR(20) NOT NULL,
  message VARCHAR(512) NOT NULL,
  operator_id BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_label_code_26 (label_code),
  KEY idx_task_action_27 (task_id, action_type),
  KEY idx_operator_time_28 (operator_id, created_at)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NULL,
  module VARCHAR(64) NOT NULL,
  operation VARCHAR(64) NOT NULL,
  business_key VARCHAR(160) NULL,
  detail VARCHAR(1024) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_user_time_30 (user_id, created_at),
  KEY idx_module_time_31 (module, created_at)
);

CREATE TABLE IF NOT EXISTS sys_menu (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  parent_id BIGINT NOT NULL DEFAULT 0,
  menu_key VARCHAR(64) NOT NULL,
  menu_name VARCHAR(64) NOT NULL,
  route_path VARCHAR(160) NULL,
  component VARCHAR(128) NULL,
  permission_code VARCHAR(128) NULL,
  icon VARCHAR(64) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  visible TINYINT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'ENABLED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_menu_key_33 (menu_key),
  KEY idx_parent_sort_34 (parent_id, sort_order),
  KEY idx_permission_code_35 (permission_code)
);

CREATE TABLE IF NOT EXISTS system_notice (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  content TEXT NOT NULL,
  notice_type VARCHAR(30) NOT NULL DEFAULT 'INFO',
  publish_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  published_at DATETIME NULL,
  created_by BIGINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_publish_status_37 (publish_status, published_at),
  KEY idx_created_by_38 (created_by)
);
