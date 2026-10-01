import { Button, Form, Input, InputNumber, Modal, Select, Switch, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createMenu, fetchSystemMenus, updateMenu } from '../api/menus';
import type { MenuSavePayload } from '../api/menus';
import { fetchPermissions } from '../api/system';
import type { AppMenu, Permission } from '../types';

const componentOptions = [
  'LAYOUT',
  'DashboardPage',
  'ProjectsPage',
  'SampleTasksPage',
  'ScanWorkbenchPage',
  'LabelPreviewPage',
  'TracePage',
  'ExceptionInterceptionPage',
  'StatisticsReportPage',
  'MenuManagementPage',
  'PermissionManagementPage',
  'UserManagementPage',
  'LogManagementPage',
  'NoticeManagementPage',
].map((value) => ({ label: value, value }));

const iconOptions = [
  'DashboardOutlined',
  'ProjectOutlined',
  'ExperimentOutlined',
  'BarcodeOutlined',
  'TagOutlined',
  'FileSearchOutlined',
  'WarningOutlined',
  'BarChartOutlined',
  'SettingOutlined',
  'MenuOutlined',
  'SafetyCertificateOutlined',
  'UserOutlined',
  'FileTextOutlined',
  'NotificationOutlined',
].map((value) => ({ label: value, value }));

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])]);
}

export function MenuManagementPage() {
  const [menus, setMenus] = useState<AppMenu[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AppMenu | null>(null);
  const [form] = Form.useForm<MenuSavePayload>();

  const flatMenus = useMemo(() => flattenMenus(menus), [menus]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [menuData, permissionData] = await Promise.all([fetchSystemMenus(), fetchPermissions()]);
      setMenus(menuData);
      setPermissions(permissionData);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '菜单数据加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = (record?: AppMenu) => {
    setEditing(record ?? null);
    form.setFieldsValue(
      record
        ? {
            parentId: record.parentId,
            menuKey: record.menuKey,
            menuName: record.menuName,
            routePath: record.routePath,
            component: record.component,
            permissionCode: record.permissionCode,
            icon: record.icon,
            sortOrder: record.sortOrder,
            visible: record.visible,
            status: record.status,
          }
        : {
            parentId: 0,
            sortOrder: 0,
            visible: true,
            status: 'ENABLED',
          },
    );
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateMenu(editing.id, values);
        message.success('菜单已更新');
      } else {
        await createMenu(values);
        message.success('菜单已新增');
      }
      setOpen(false);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存菜单失败');
    }
  };

  const parentOptions = [
    { label: '根菜单', value: 0 },
    ...flatMenus
      .filter((menu) => menu.id !== editing?.id)
      .map((menu) => ({ label: menu.menuName, value: menu.id })),
  ];
  const permissionOptions = permissions.map((item) => ({
    label: `${item.permissionCode}｜${item.permissionName}`,
    value: item.permissionCode,
  }));

  const columns: ColumnsType<AppMenu> = [
    { title: '菜单名称', dataIndex: 'menuName', width: 180 },
    { title: '路由地址', dataIndex: 'routePath', width: 180, render: (value?: string) => value || '-' },
    { title: '组件', dataIndex: 'component', width: 180, render: (value?: string) => value || '-' },
    { title: '权限码', dataIndex: 'permissionCode', width: 180, render: (value?: string) => value || '-' },
    { title: '排序', dataIndex: 'sortOrder', width: 80 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: string) => <Tag color={value === 'ENABLED' ? 'success' : 'default'}>{value === 'ENABLED' ? '启用' : '停用'}</Tag>,
    },
    {
      title: '显示',
      dataIndex: 'visible',
      width: 80,
      render: (value: boolean) => (value ? '是' : '否'),
    },
    {
      title: '操作',
      width: 90,
      render: (_, record) => (
        <Button type="link" onClick={() => handleOpen(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>菜单管理</Typography.Title>
          <Typography.Text type="secondary">维护侧边栏菜单、动态路由、组件映射和菜单权限码</Typography.Text>
        </div>
        <Button type="primary" onClick={() => handleOpen()}>
          新增菜单
        </Button>
      </div>

      <Table rowKey="id" columns={columns} dataSource={menus} loading={loading} pagination={false} />

      <Modal
        title={editing ? '编辑菜单' : '新增菜单'}
        open={open}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form<MenuSavePayload> form={form} layout="vertical">
          <div className="two-column-form">
            <Form.Item name="parentId" label="上级菜单" rules={[{ required: true, message: '请选择上级菜单' }]}>
              <Select options={parentOptions} />
            </Form.Item>
            <Form.Item name="menuKey" label="菜单标识" rules={[{ required: true, message: '请输入菜单标识' }]}>
              <Input placeholder="system-notices" />
            </Form.Item>
            <Form.Item name="menuName" label="菜单名称" rules={[{ required: true, message: '请输入菜单名称' }]}>
              <Input placeholder="公告管理" />
            </Form.Item>
            <Form.Item name="routePath" label="路由地址">
              <Input placeholder="/system/notices" />
            </Form.Item>
            <Form.Item name="component" label="组件">
              <Select allowClear showSearch options={componentOptions} />
            </Form.Item>
            <Form.Item name="permissionCode" label="权限码">
              <Select allowClear showSearch options={permissionOptions} />
            </Form.Item>
            <Form.Item name="icon" label="图标">
              <Select allowClear showSearch options={iconOptions} />
            </Form.Item>
            <Form.Item name="sortOrder" label="排序">
              <InputNumber className="full-width" min={0} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select
                options={[
                  { label: '启用', value: 'ENABLED' },
                  { label: '停用', value: 'DISABLED' },
                ]}
              />
            </Form.Item>
            <Form.Item name="visible" label="是否显示" valuePropName="checked">
              <Switch checkedChildren="显示" unCheckedChildren="隐藏" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
