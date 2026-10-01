import { Button, Checkbox, Form, Input, Modal, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createPermission,
  createRole,
  fetchPermissions,
  fetchRoles,
  updateRolePermissions,
} from '../api/system';
import type { PermissionSavePayload, RoleSavePayload } from '../api/system';
import type { Permission, Role } from '../types';

export function PermissionManagementPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermissionCodes, setSelectedPermissionCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [permissionForm] = Form.useForm<PermissionSavePayload>();
  const [roleForm] = Form.useForm<RoleSavePayload>();

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  const permissionGroups = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((acc, permission) => {
      acc[permission.module] = acc[permission.module] ?? [];
      acc[permission.module].push(permission);
      return acc;
    }, {});
  }, [permissions]);

  const load = useCallback(async (preferredRoleId?: number | null) => {
    setLoading(true);
    try {
      const [permissionData, roleData] = await Promise.all([fetchPermissions(), fetchRoles()]);
      setPermissions(permissionData);
      setRoles(roleData);
      const nextSelected = preferredRoleId ?? roleData[0]?.id ?? null;
      setSelectedRoleId(nextSelected);
      const nextRole = roleData.find((role) => role.id === nextSelected);
      setSelectedPermissionCodes(nextRole?.permissionCodes ?? []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '权限数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSelectRole = (role: Role) => {
    setSelectedRoleId(role.id);
    setSelectedPermissionCodes(role.permissionCodes);
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;
    try {
      await updateRolePermissions(selectedRoleId, selectedPermissionCodes);
      message.success('角色权限已更新');
      await load(selectedRoleId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '角色权限更新失败');
    }
  };

  const handleCreatePermission = async () => {
    const values = await permissionForm.validateFields();
    try {
      await createPermission(values);
      message.success('权限已新增');
      setPermissionModalOpen(false);
      permissionForm.resetFields();
      await load(selectedRoleId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增权限失败');
    }
  };

  const handleCreateRole = async () => {
    const values = await roleForm.validateFields();
    try {
      await createRole(values);
      message.success('角色已新增');
      setRoleModalOpen(false);
      roleForm.resetFields();
      await load(selectedRoleId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '新增角色失败');
    }
  };

  const permissionColumns: ColumnsType<Permission> = [
    { title: '权限编码', dataIndex: 'permissionCode', width: 220 },
    { title: '权限名称', dataIndex: 'permissionName', width: 180 },
    { title: '模块', dataIndex: 'module', width: 120 },
  ];

  const roleColumns: ColumnsType<Role> = [
    { title: '角色编码', dataIndex: 'roleCode', width: 140 },
    { title: '角色名称', dataIndex: 'roleName', width: 140 },
    { title: '说明', dataIndex: 'description', render: (value?: string) => value || '-' },
    {
      title: '权限数',
      width: 90,
      render: (_, record) => record.permissionCodes.length,
    },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>权限管理</Typography.Title>
          <Typography.Text type="secondary">维护权限码、角色，并为角色分配接口权限</Typography.Text>
        </div>
      </div>
      <Tabs
        items={[
          {
            key: 'roles',
            label: '角色授权',
            children: (
              <div className="permission-layout">
                <div>
                  <div className="table-toolbar">
                    <Button type="primary" onClick={() => setRoleModalOpen(true)}>
                      新增角色
                    </Button>
                  </div>
                  <Table
                    rowKey="id"
                    columns={roleColumns}
                    dataSource={roles}
                    loading={loading}
                    pagination={false}
                    rowClassName={(record) => (record.id === selectedRoleId ? 'selected-row' : '')}
                    onRow={(record) => ({ onClick: () => handleSelectRole(record) })}
                  />
                </div>
                <div className="permission-editor">
                  <Typography.Title level={5}>为角色分配权限</Typography.Title>
                  {selectedRole ? (
                    <>
                      <Space className="role-summary">
                        <Tag color="blue">{selectedRole.roleCode}</Tag>
                        <Typography.Text strong>{selectedRole.roleName}</Typography.Text>
                      </Space>
                      <Checkbox.Group
                        value={selectedPermissionCodes}
                        onChange={(values) => setSelectedPermissionCodes(values.map(String))}
                        className="permission-checkbox-group"
                      >
                        {Object.entries(permissionGroups).map(([module, items]) => (
                          <div className="permission-module" key={module}>
                            <Typography.Text strong>{module}</Typography.Text>
                            <div className="permission-checkboxes">
                              {items.map((item) => (
                                <Checkbox value={item.permissionCode} key={item.permissionCode}>
                                  {item.permissionName}（{item.permissionCode}）
                                </Checkbox>
                              ))}
                            </div>
                          </div>
                        ))}
                      </Checkbox.Group>
                      <Button type="primary" onClick={() => void handleSavePermissions()}>
                        保存角色权限
                      </Button>
                    </>
                  ) : (
                    <Typography.Text type="secondary">请选择角色</Typography.Text>
                  )}
                </div>
              </div>
            ),
          },
          {
            key: 'permissions',
            label: '权限字典',
            children: (
              <>
                <div className="table-toolbar">
                  <Button type="primary" onClick={() => setPermissionModalOpen(true)}>
                    新增权限
                  </Button>
                </div>
                <Table rowKey="id" columns={permissionColumns} dataSource={permissions} loading={loading} />
              </>
            ),
          },
        ]}
      />

      <Modal
        title="新增权限"
        open={permissionModalOpen}
        onOk={() => void handleCreatePermission()}
        onCancel={() => setPermissionModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form<PermissionSavePayload> form={permissionForm} layout="vertical">
          <Form.Item name="permissionCode" label="权限编码" rules={[{ required: true, message: '请输入权限编码' }]}>
            <Input placeholder="notice:view" />
          </Form.Item>
          <Form.Item name="permissionName" label="权限名称" rules={[{ required: true, message: '请输入权限名称' }]}>
            <Input placeholder="查看公告" />
          </Form.Item>
          <Form.Item name="module" label="模块" rules={[{ required: true, message: '请输入模块' }]}>
            <Input placeholder="系统" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新增角色"
        open={roleModalOpen}
        onOk={() => void handleCreateRole()}
        onCancel={() => setRoleModalOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form<RoleSavePayload> form={roleForm} layout="vertical">
          <Form.Item name="roleCode" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input placeholder="QA_MANAGER" />
          </Form.Item>
          <Form.Item name="roleName" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="质量负责人" />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
