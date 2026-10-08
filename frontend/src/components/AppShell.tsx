import {
  AuditOutlined,
  BarChartOutlined,
  BarcodeOutlined,
  DashboardOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  NotificationOutlined,
  ProjectOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  TagOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Layout, Menu, Space, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/AuthContext';
import type { AppMenu } from '../types';

const { Header, Sider, Content } = Layout;

const iconMap: Record<string, ReactNode> = {
  AuditOutlined: <AuditOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  BarcodeOutlined: <BarcodeOutlined />,
  DashboardOutlined: <DashboardOutlined />,
  ExperimentOutlined: <ExperimentOutlined />,
  FileSearchOutlined: <FileSearchOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  MenuOutlined: <MenuOutlined />,
  NotificationOutlined: <NotificationOutlined />,
  ProjectOutlined: <ProjectOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  SettingOutlined: <SettingOutlined />,
  TagOutlined: <TagOutlined />,
  UserOutlined: <UserOutlined />,
  WarningOutlined: <WarningOutlined />,
};

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])]);
}

const legacyPageComponents = new Set([
  'DashboardPage',
  'ProjectsPage',
  'SampleTasksPage',
  'ScanWorkbenchPage',
  'LabelPreviewPage',
  'TracePage',
  'ExceptionInterceptionPage',
  'StatisticsReportPage',
]);

function toMenuItems(menus: AppMenu[]): MenuProps['items'] {
  return menus.filter((menu) => !legacyPageComponents.has(menu.component || '')).map((menu) => ({
    key: menu.menuKey,
    icon: menu.icon ? iconMap[menu.icon] : undefined,
    label: menu.menuName,
    children: menu.children?.length ? toMenuItems(menu.children) : undefined,
  }));
}

export function AppShell() {
  const { user, menus: serverMenus, logout } = useAuth();
  const hasExperiments = flattenMenus(serverMenus).some(
    (menu) => menu.component === 'ExperimentsPage',
  );
  function adapt(menus: AppMenu[]): AppMenu[] {
    return menus.map((menu) => ({
      ...menu,
      routePath:
        hasExperiments && menu.component === 'DashboardPage' && menu.routePath === '/'
          ? '/legacy-workbench'
          : menu.routePath,
      children: adapt(menu.children || []),
    }));
  }
  const menus = adapt(serverMenus);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);

  const flatMenus = flattenMenus(menus);
  const selected = flatMenus.find((item) => item.routePath === location.pathname);
  const openKeys = flatMenus
    .filter((item) => item.children?.some((child) => child.menuKey === selected?.menuKey))
    .map((item) => item.menuKey);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    const item = flatMenus.find((menu) => menu.menuKey === key);
    if (item?.routePath && item.component !== 'LAYOUT') {
      navigate(item.routePath);
      setMobileMenu(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout className="app-shell">
      <Sider width={232} className="app-sider">
        <div className="brand">
          <div className="brand-mark">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </div>
          <div>
            <Typography.Text strong>标签核对系统</Typography.Text>
            <Typography.Text type="secondary">采血样品核对</Typography.Text>
          </div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selected ? [selected.menuKey] : ['dashboard']}
          defaultOpenKeys={openKeys}
          items={toMenuItems(menus)}
          onClick={handleMenuClick}
          className="side-menu"
        />
      </Sider>
      <Layout className="app-main-layout">
        <Header className="app-header">
          <div className="app-header-inner">
            <Button
              className="mobile-menu-toggle"
              aria-label="打开导航"
              icon={<MenuOutlined />}
              onClick={() => setMobileMenu(true)}
            />
            <div className="app-title-block">
              <Typography.Title level={4} className="page-title">
                标签核对系统
              </Typography.Title>
              <Typography.Text type="secondary">标签条码化、扫码核对、自动留痕</Typography.Text>
            </div>
            <Space size={14} className="header-actions">
              <Avatar>{user?.realName?.slice(0, 1) ?? 'U'}</Avatar>
              <div className="user-info">
                <Typography.Text strong>{user?.realName}</Typography.Text>
                <Typography.Text type="secondary">{user?.department}</Typography.Text>
              </div>
              <Button icon={<LogoutOutlined />} onClick={handleLogout}>
                退出
              </Button>
            </Space>
          </div>
        </Header>
        <Drawer
          title="功能导航"
          open={mobileMenu}
          onClose={() => setMobileMenu(false)}
          placement="left"
          width={290}
        >
          <Menu
            mode="inline"
            selectedKeys={selected ? [selected.menuKey] : []}
            items={toMenuItems(menus)}
            onClick={handleMenuClick}
          />
        </Drawer>
        <Content className="app-content">
          <div className="app-content-inner">
            {selected?.component &&
              legacyPageComponents.has(selected.component) && (
                <div className="legacy-workflow-note">
                  旧版资料与历史记录
                  {flatMenus.some((menu) => menu.component === 'ExperimentsPage') && (
                    <Button type="link" onClick={() => navigate('/experiments')}>
                      进入实验列表开展新核对
                    </Button>
                  )}
                </div>
              )}
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
