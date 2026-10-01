INSERT INTO sys_permission (permission_code, permission_name, module)
SELECT 'user:view', '查看用户', '系统'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'user:view');

INSERT INTO sys_permission (permission_code, permission_name, module)
SELECT 'user:create', '新增用户', '系统'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'user:create');

INSERT INTO sys_permission (permission_code, permission_name, module)
SELECT 'user:update', '编辑用户', '系统'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'user:update');

INSERT INTO sys_permission (permission_code, permission_name, module)
SELECT 'user:reset-password', '重置用户密码', '系统'
WHERE NOT EXISTS (SELECT 1 FROM sys_permission WHERE permission_code = 'user:reset-password');

INSERT INTO sys_menu (
  parent_id,
  menu_key,
  menu_name,
  route_path,
  component,
  permission_code,
  icon,
  sort_order,
  visible,
  status
)
SELECT
  parent.id,
  'system-users',
  '用户管理',
  '/system/users',
  'UserManagementPage',
  'user:view',
  'UserOutlined',
  20,
  1,
  'ENABLED'
FROM sys_menu parent
WHERE parent.menu_key = 'system'
  AND NOT EXISTS (SELECT 1 FROM sys_menu WHERE menu_key = 'system-users')
LIMIT 1;
