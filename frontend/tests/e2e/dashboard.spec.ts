import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SampleTask, ScanRecord } from '../../src/types';

const tasks: SampleTask[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, projectId: 1, projectCode: 'PROJECT-A', projectName: '测试项目', testArticle: '测试供试品',
  animalNo: `ANIMAL-${index + 1}`, labelCode: `LABEL-${index + 1}`, sampleType: index === 1 ? '血清' : 'PK',
  timePoint: 'D1', plannedCollectDate: index === 1 ? '2026-09-18' : '2026-09-17',
  status: index === 0 ? 'BOUND' : index === 1 ? 'RECORDED' : 'PRINTED', createdAt: '2026-09-17T09:00:00',
}));
const records: ScanRecord[] = [{
  id: 1, labelCode: 'LABEL-2', actionType: 'VERIFY', result: 'PASS', operatorName: '核对员李某',
  expectedSummary: '测试期望', scannedPayload: '测试扫描', message: '测试核对记录', createdAt: '2026-09-17T10:00:00',
}];
const pageMenus = [
  ['/', '工作台', 'DashboardPage'], ['/tasks', '采样任务', 'SampleTasksPage'],
  ['/scan', '扫码核对', 'ScanWorkbenchPage'], ['/labels', '标签预览', 'LabelPreviewPage'],
  ['/trace-custom', '追溯记录', 'TracePage'], ['/exceptions', '异常拦截', 'ExceptionInterceptionPage'],
  ['/statistics', '统计报表', 'StatisticsReportPage'], ['/projects', '项目管理', 'ProjectsPage'],
  ['/users', '用户管理', 'UserManagementPage'], ['/menus', '菜单管理', 'MenuManagementPage'],
  ['/permissions', '权限管理', 'PermissionManagementPage'], ['/logs', '日志管理', 'LogManagementPage'],
  ['/notices', '公告管理', 'NoticeManagementPage'],
].map(([routePath, menuName, component], index) => ({
  id: index + 1, parentId: 0, menuKey: component, routePath, menuName, component, children: [],
  visible: true, status: 'ENABLED', sortOrder: index,
}));

interface MockOptions {
  permissions?: string[];
  failRecords?: boolean;
  failTasks?: boolean;
  emptyTasks?: boolean;
}

async function openWorkbench(page: Page, options: MockOptions = {}): Promise<string[]> {
  const requests: string[] = [];
  // 所有接口均由固定测试数据响应，未知写请求也被拦截，不接触业务数据库。
  await page.route(/^http:\/\/127\.0\.0\.1:5175\/api\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    if ((options.failRecords && path === '/api/scan-records') || (options.failTasks && path === '/api/sample-tasks')) {
      await route.fulfill({ status: 500, json: { code: 500, message: '测试服务不可用' } });
      return;
    }
    let data: unknown = [];
    if (path === '/api/auth/me') data = { id: 1, username: 'tester', realName: '测试员', department: '测试', roles: [], permissions: options.permissions ?? ['*'] };
    else if (path === '/api/menus/routes' || path === '/api/system/menus') data = pageMenus;
    else if (path === '/api/sample-tasks') data = options.emptyTasks ? [] : tasks;
    else if (path === '/api/scan-records') data = records;
    else if (path === '/api/workbench/summary') data = { totalTasks: 12, checkedTasks: 1, passedTasks: 1, failedRecords: 0, pendingTasks: 11, traceRecords: 1, checkedRate: 8.33, passedRate: 8.33, exceptionRate: 0, pendingRate: 91.67 };
    else if (path === '/api/scan/verify') {
      await route.fulfill({ status: 400, json: { code: 400, message: '测试未配置写操作' } });
      return;
    }
    await route.fulfill({ json: { code: 200, message: '成功', data } });
  });
  await page.addInitScript(() => localStorage.setItem('tag-management-token', 'isolated-test-token'));
  await page.goto('/');
  await expect(page.getByText('等待扫码核对', { exact: true })).toBeVisible();
  await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);
  return requests;
}

test('所有状态均能查看详情，操作列在窄桌面保持可见，查看不会提交核对', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const requests = await openWorkbench(page);
  const view = page.getByRole('button', { name: '查看', exact: true }).first();
  const box = await view.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  await page.screenshot({ path: 'test-results/工作台桌面.png', animations: 'disabled', fullPage: true });
  await view.click();
  const detail = page.getByRole('dialog', { name: '采样任务详情' });
  await expect(detail).toBeVisible();
  await expect(detail.getByText('LABEL-1', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '查看', exact: true }).nth(1).click();
  await expect(detail.getByText('核对员李某')).toBeVisible();
  await page.screenshot({ path: 'test-results/工作台任务详情.png', animations: 'disabled' });
  expect(requests.filter((path) => path === '/api/scan/verify')).toHaveLength(0);
});

test('标签大图显示所选标签，并支持关闭', async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole('button', { name: '查看大图' }).click();
  const modal = page.getByRole('dialog', { name: '标签大图' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('ANIMAL-1', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/工作台标签大图.png', animations: 'disabled' });
  await modal.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(modal).not.toBeVisible();
});

test('更多记录跳转到动态菜单配置的路由', async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole('button', { name: '更多记录' }).click();
  await expect(page).toHaveURL(/trace-custom$/);
  await expect(page.getByRole('tab', { name: '扫码记录' })).toBeVisible();
});

test('第十一条任务可分页访问，状态和关键词联合筛选生效', async ({ page }) => {
  await openWorkbench(page);
  const panel = page.locator('.workbench-task-panel');
  await panel.getByTitle('2', { exact: true }).click();
  await expect(panel.getByText('ANIMAL-11 / PROJECT-A')).toBeVisible();
  await page.getByRole('combobox', { name: '任务状态' }).click();
  await page.getByText('已录入', { exact: true }).last().click();
  await expect(panel.getByRole('button', { name: '查看', exact: true })).toHaveCount(1);
  await page.getByPlaceholder('条码 / 动物号 / 项目号').fill('LABEL-2');
  await expect(panel.getByText('ANIMAL-2 / PROJECT-A')).toBeVisible();
  await page.getByPlaceholder('条码 / 动物号 / 项目号').fill('不存在的条码');
  await expect(panel.getByText('暂无符合条件的采样任务')).toBeVisible();
});

test('样本类型与计划采集日期筛选生效', async ({ page }) => {
  await openWorkbench(page);
  await page.getByRole('combobox', { name: '样本类型' }).click();
  await page.locator('.ant-select-item-option-content').getByText('血清', { exact: true }).click();
  const panel = page.locator('.workbench-task-panel');
  await expect(panel.getByRole('button', { name: '查看', exact: true })).toHaveCount(1);
  const date = page.getByRole('textbox', { name: '任务采集日期' });
  await date.fill('2026-09-17');
  await date.press('Enter');
  await expect(panel.getByText('暂无符合条件的采样任务')).toBeVisible();
});

test('扫描另一任务不会自动切换核对依据，失败显示拦截且重扫清除结果', async ({ page }) => {
  await openWorkbench(page);
  let submitted: unknown;
  await page.route('**/api/scan/verify', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ json: { code: 200, data: { passed: false, message: '动物号不一致', taskStatus: 'RECORDED', task: tasks[1] } } });
  });
  const scan = page.getByPlaceholder('请扫描样本条码或标签条码');
  await expect(scan).toHaveValue('');
  await scan.fill('LABEL-2');
  await scan.press('Enter');
  await expect(page.locator('.workbench-scan-feedback')).toHaveClass(/ant-alert-error/);
  expect(submitted).toEqual({ labelCode: 'LABEL-2', projectCode: 'PROJECT-A', animalNo: 'ANIMAL-1', timePoint: 'D1' });
  await expect(page.locator('.scan-result-grid').getByText('ANIMAL-1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '重新扫描' }).click();
  await expect(page.getByText('等待扫码核对', { exact: true })).toBeVisible();
  await expect(scan).toHaveValue('');
});

test('空白条码校验不发送请求，未绑定任务不能通过回车提交', async ({ page }) => {
  const requests = await openWorkbench(page);
  const scan = page.getByPlaceholder('请扫描样本条码或标签条码');
  await scan.fill('   ');
  await page.getByRole('button', { name: '提交核对' }).click();
  await expect(page.getByText('请扫描标签码', { exact: true })).toBeVisible();
  await page.getByText('ANIMAL-3 / PROJECT-A').click();
  await scan.fill('LABEL-3');
  await scan.press('Enter');
  await expect(page.getByRole('button', { name: '提交核对' })).toBeDisabled();
  expect(requests.filter((path) => path === '/api/scan/verify')).toHaveLength(0);
});

test('成功核对刷新选中任务状态，重复点击只提交一次', async ({ page }) => {
  await openWorkbench(page);
  let count = 0;
  let completed = false;
  const verifiedTask: SampleTask = { ...tasks[0], status: 'VERIFIED' };
  await page.route('**/api/sample-tasks', (route) => route.fulfill({ json: { code: 200, data: completed ? [verifiedTask, ...tasks.slice(1)] : tasks } }));
  await page.route('**/api/scan/verify', async (route) => {
    count += 1;
    await new Promise((resolve) => setTimeout(resolve, 200));
    completed = true;
    await route.fulfill({ json: { code: 200, data: { passed: true, message: '核对成功', taskStatus: 'VERIFIED', task: verifiedTask } } });
  });
  await page.getByPlaceholder('请扫描样本条码或标签条码').fill('LABEL-1');
  await page.getByRole('button', { name: '提交核对' }).dblclick();
  await expect(page.locator('.workbench-scan-feedback')).toHaveClass(/ant-alert-success/);
  await expect(page.locator('.scan-result-grid').getByText('已通过', { exact: true })).toBeVisible();
  expect(count).toBe(1);
  await expect(page.getByRole('button', { name: '提交核对' })).toBeDisabled();
});

test('仅记录权限不请求任务，空数据不展示可操作大图', async ({ page }) => {
  const requests = await openWorkbench(page, { permissions: ['record:view'] });
  expect(requests).not.toContain('/api/sample-tasks');
  await expect(page.getByRole('button', { name: '查看大图' })).toBeDisabled();
  await expect(page.getByText('当前账号无采样任务查看权限')).toBeVisible();
});

test('受限账号不请求无权数据，任务详情仍可打开', async ({ page }) => {
  const requests = await openWorkbench(page, { permissions: ['sample:view'] });
  await expect(page.getByRole('button', { name: '提交核对' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '更多记录' })).toHaveCount(0);
  await page.getByRole('button', { name: '查看', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('当前账号无扫码记录查看权限')).toBeVisible();
  expect(requests).not.toContain('/api/scan-records');
});

test('扫码记录失败不会清空任务，并提供重试和详情错误提示', async ({ page }) => {
  await openWorkbench(page, { failRecords: true });
  await expect(page.getByRole('button', { name: '查看', exact: true })).toHaveCount(10);
  await expect(page.getByRole('button', { name: /^重\s*试$/ })).toBeVisible();
  await page.getByRole('button', { name: '查看', exact: true }).first().click();
  await expect(page.getByRole('dialog').getByText('扫码记录加载失败，请重试')).toBeVisible();
});

test('空任务禁用大图，任务加载失败不丢失已有扫码记录', async ({ page }) => {
  await openWorkbench(page, { failTasks: true });
  await expect(page.getByRole('button', { name: '查看大图' })).toBeDisabled();
  await expect(page.getByText('测试核对记录')).toBeVisible();
});

test('各功能模块在完整权限与固定数据下可打开', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWorkbench(page);
  for (const menu of pageMenus) {
    await page.goto(menu.routePath);
    await expect(page.locator('.route-loading')).toHaveCount(0);
    await expect(page.locator('.content-panel, .metric-strip, .metric-panel').first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});
