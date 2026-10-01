import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUser,
  fetchRoles,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from '../api/system';
import type { UserCreatePayload, UserUpdatePayload } from '../api/system';
import { useAuth } from '../stores/AuthContext';
import type { Role, SystemUser } from '../types';
import { formatDateTime } from '../utils/status';

interface UserFormValues {
  username?: string;
  password?: string;
  realName: string;
  department?: string;
  status: SystemUser['status'];
  roleIds: number[];
}

interface PasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

export function UserManagementPage() {
  const { user: currentUser, hasPermission } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SystemUser | null>(null);
  const [userForm] = Form.useForm<UserFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();

  const canReadRoles = hasPermission('role:view');
  const canCreate = hasPermission('user:create') && canReadRoles;
  const canUpdate = hasPermission('user:update') && canReadRoles;
  const canResetPassword = hasPermission('user:reset-password');

  const load = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      const [userData, roleData] = await Promise.all([
        fetchUsers(searchKeyword),
        canReadRoles ? fetchRoles() : Promise.resolve([]),
      ]);
      setUsers(userData);
      setRoles(roleData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [canReadRoles]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleOptions = useMemo(
    () => roles.map((role) => ({ label: `${role.roleName}（${role.roleCode}）`, value: role.id })),
    [roles],
  );

  const openCreate = () => {
    setEditingUser(null);
    userForm.resetFields();
    userForm.setFieldsValue({ status: 'ENABLED', roleIds: [] });
    setUserModalOpen(true);
  };

  const openEdit = (user: SystemUser) => {
    setEditingUser(user);
    userForm.setFieldsValue({
      realName: user.realName,
      department: user.department,
      status: user.status,
      roleIds: user.roleIds,
    });
    setUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    const values = await userForm.validateFields();
    try {
      if (editingUser) {
        const payload: UserUpdatePayload = {
          realName: values.realName,
          department: values.department,
          status: values.status,
          roleIds: values.roleIds,
        };
        await updateUser(editingUser.id, payload);
        message.success('用户已更新');
      } else {
        const payload: UserCreatePayload = {
          username: values.username ?? '',
          password: values.password ?? '',
          realName: values.realName,
          department: values.department,
          status: values.status,
          roleIds: values.roleIds,
        };
        await createUser(payload);
        message.success('用户已创建');
      }
      setUserModalOpen(false);
      await load(keyword);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '用户保存失败');
    }
  };

  const openPasswordReset = (user: SystemUser) => {
    setPasswordUser(user);
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!passwordUser) return;
    const values = await passwordForm.validateFields();
    try {
      await resetUserPassword(passwordUser.id, values.newPassword);
      message.success('密码已重置');
      setPasswordModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '密码重置失败');
    }
  };

  const columns: ColumnsType<SystemUser> = [
    { title: '用户名', dataIndex: 'username', width: 150 },
    { title: '姓名', dataIndex: 'realName', width: 140 },
    { title: '部门', dataIndex: 'department', width: 180, render: (value?: string) => value || '-' },
    {
      title: '角色',
      dataIndex: 'roleNames',
      render: (roleNames: string[]) => roleNames.map((name) => <Tag key={name}>{name}</Tag>),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: SystemUser['status']) => (
        <Tag color={status === 'ENABLED' ? 'success' : 'default'}>
          {status === 'ENABLED' ? '启用' : '停用'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size={4}>
          {canUpdate && (
            <Button type="link" onClick={() => openEdit(record)}>
              编辑
            </Button>
          )}
          {canResetPassword && (
            <Button type="link" onClick={() => openPasswordReset(record)}>
              重置密码
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>用户管理</Typography.Title>
          <Typography.Text type="secondary">维护账号状态、所属部门和角色，密码操作单独授权</Typography.Text>
        </div>
        <Space wrap>
          <Input.Search
            placeholder="用户名、姓名、部门"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => void load(value)}
            allowClear
            style={{ width: 260 }}
          />
          {canCreate && (
            <Button type="primary" onClick={openCreate}>
              新增用户
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        scroll={{ x: 1100 }}
      />

      <Modal
        title={editingUser ? `编辑用户：${editingUser.username}` : '新增用户'}
        open={userModalOpen}
        onOk={() => void handleSaveUser()}
        onCancel={() => setUserModalOpen(false)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form<UserFormValues> form={userForm} layout="vertical">
          {!editingUser && (
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 4, max: 64, message: '用户名长度必须为 4 到 64 位' },
                { pattern: /^[A-Za-z0-9._-]+$/, message: '只能包含字母、数字、点、下划线和横线' },
              ]}
            >
              <Input autoComplete="off" placeholder="operator01" />
            </Form.Item>
          )}
          {!editingUser && (
            <Form.Item
              name="password"
              label="初始密码"
              rules={[
                { required: true, message: '请输入初始密码' },
                { min: 8, max: 72, message: '密码长度必须为 8 到 72 位' },
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item name="department" label="部门">
            <Input maxLength={128} />
          </Form.Item>
          <Form.Item name="roleIds" label="角色" rules={[{ required: true, message: '请至少分配一个角色' }]}>
            <Select
              mode="multiple"
              disabled={editingUser?.id === currentUser?.id}
              options={roleOptions}
              placeholder="请选择角色"
            />
          </Form.Item>
          <Form.Item name="status" label="状态" rules={[{ required: true, message: '请选择状态' }]}>
            <Select
              disabled={editingUser?.id === currentUser?.id}
              options={[
                { label: '启用', value: 'ENABLED' },
                { label: '停用', value: 'DISABLED' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`重置密码${passwordUser ? `：${passwordUser.username}` : ''}`}
        open={passwordModalOpen}
        onOk={() => void handleResetPassword()}
        onCancel={() => setPasswordModalOpen(false)}
        okText="确认重置"
        cancelText="取消"
        destroyOnClose
      >
        <Form<PasswordFormValues> form={passwordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, max: 72, message: '密码长度必须为 8 到 72 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || value === getFieldValue('newPassword')) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
