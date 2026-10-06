import { Result, Spin } from 'antd';
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AuthProvider, useAuth } from './stores/AuthContext';
import type { AppMenu } from './types';

const componentMap: Record<string, LazyExoticComponent<ComponentType>> = {
  ExperimentsPage: lazy(() =>
    import('./pages/experiments/ExperimentsPage').then((module) => ({
      default: module.ExperimentsPage,
    })),
  ),
  DashboardPage: lazy(() =>
    import('./pages/DashboardPage').then((module) => ({
      default: module.DashboardPage,
    })),
  ),
  ProjectsPage: lazy(() =>
    import('./pages/ProjectsPage').then((module) => ({
      default: module.ProjectsPage,
    })),
  ),
  SampleTasksPage: lazy(() =>
    import('./pages/SampleTasksPage').then((module) => ({
      default: module.SampleTasksPage,
    })),
  ),
  ScanWorkbenchPage: lazy(() =>
    import('./pages/ScanWorkbenchPage').then((module) => ({
      default: module.ScanWorkbenchPage,
    })),
  ),
  LabelPreviewPage: lazy(() =>
    import('./pages/LabelPreviewPage').then((module) => ({
      default: module.LabelPreviewPage,
    })),
  ),
  TracePage: lazy(() =>
    import('./pages/TracePage').then((module) => ({
      default: module.TracePage,
    })),
  ),
  ExceptionInterceptionPage: lazy(() =>
    import('./pages/ExceptionInterceptionPage').then((module) => ({
      default: module.ExceptionInterceptionPage,
    })),
  ),
  StatisticsReportPage: lazy(() =>
    import('./pages/StatisticsReportPage').then((module) => ({
      default: module.StatisticsReportPage,
    })),
  ),
  MenuManagementPage: lazy(() =>
    import('./pages/MenuManagementPage').then((module) => ({
      default: module.MenuManagementPage,
    })),
  ),
  PermissionManagementPage: lazy(() =>
    import('./pages/PermissionManagementPage').then((module) => ({
      default: module.PermissionManagementPage,
    })),
  ),
  UserManagementPage: lazy(() =>
    import('./pages/UserManagementPage').then((module) => ({
      default: module.UserManagementPage,
    })),
  ),
  LogManagementPage: lazy(() =>
    import('./pages/LogManagementPage').then((module) => ({
      default: module.LogManagementPage,
    })),
  ),
  NoticeManagementPage: lazy(() =>
    import('./pages/NoticeManagementPage').then((module) => ({
      default: module.NoticeManagementPage,
    })),
  ),
};

function flattenMenus(menus: AppMenu[]): AppMenu[] {
  return menus.flatMap((menu) => [menu, ...flattenMenus(menu.children ?? [])]);
}

function toChildPath(routePath: string): string {
  return routePath.replace(/^\//, '');
}

function renderPage(componentName: string) {
  const Component = componentMap[componentName];
  if (!Component) return null;
  return (
    <Suspense
      fallback={
        <div className="center-screen route-loading">
          <Spin size="large" />
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}

function DynamicRoutes() {
  const { menus } = useAuth();
  const routeMenus = flattenMenus(menus).filter((menu) => {
    return Boolean(menu.routePath && menu.component && menu.component !== 'LAYOUT');
  });
  const experimentPath = routeMenus.find((menu) => menu.component === 'ExperimentsPage')?.routePath;
  const defaultPath =
    experimentPath ??
    routeMenus.find((menu) => menu.routePath === '/')?.routePath ??
    routeMenus[0]?.routePath;
  const fallbackElement = defaultPath ? (
    <Navigate to={defaultPath} replace />
  ) : (
    <Result
      status="403"
      title="暂无可用菜单"
      subTitle="当前账号未分配可访问的功能，请联系管理员配置角色权限。"
    />
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          {routeMenus.map((menu) => {
            const element = menu.component ? renderPage(menu.component) : null;
            if (!element || !menu.routePath) return null;
            if (menu.routePath === '/') {
              return (
                <Route
                  index
                  element={experimentPath ? <Navigate to={experimentPath} replace /> : element}
                  key={menu.menuKey}
                />
              );
            }
            return (
              <Route path={toChildPath(menu.routePath)} element={element} key={menu.menuKey} />
            );
          })}
          {experimentPath &&
            routeMenus.some(
              (menu) => menu.component === 'DashboardPage' && menu.routePath === '/',
            ) && <Route path="legacy-workbench" element={renderPage('DashboardPage')} />}
          <Route path="*" element={fallbackElement} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <DynamicRoutes />
      </Router>
    </AuthProvider>
  );
}
