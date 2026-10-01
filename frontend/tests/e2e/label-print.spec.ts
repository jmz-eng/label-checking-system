import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { SampleTask } from '../../src/types';
import { createLabelLayout, DOTS_PER_MODULE, QUIET_MODULES } from '../../src/utils/labelLayout';

const task: SampleTask = {
  id: 1, projectId: 1, projectCode: 'SN26007PK02', projectName: '打印回归测试', testArticle: '测试',
  labelCode: 'TM-SN26007PK02-31211PK-D196H-0002', animalNo: '312-11-PK', sampleType: '血常规',
  timePoint: 'D1-96h', plannedCollectDate: '2026-06-09', status: 'BOUND', createdAt: '2026-06-09T09:00:00',
};
const second: SampleTask = { ...task, id: 2, animalNo: '312-12-PK', labelCode: 'TM-SN26007PK02-31212PK-D196H-0003' };

async function openLabels(page: Page, data = [task, second]): Promise<void> {
  await page.route(/^http:\/\/127\.0\.0\.1:5175\/api\//, async (route) => {
    const url = new URL(route.request().url());
    let response: unknown = [];
    if (url.pathname === '/api/auth/me') response = { id: 1, username: 'tester', realName: '测试员', roles: [], permissions: ['*'] };
    if (url.pathname === '/api/menus/routes') response = [{ id: 1, parentId: 0, menuKey: 'labels', routePath: '/labels', menuName: '标签预览', component: 'LabelPreviewPage', visible: true, status: 'ENABLED', children: [] }];
    if (url.pathname === '/api/sample-tasks') response = url.searchParams.get('keyword') === '空结果' ? [] : url.searchParams.get('keyword') === '第二张' ? [second] : data;
    await route.fulfill({ json: { code: 200, data: response } });
  });
  await page.addInitScript(() => localStorage.setItem('tag-management-token', 'isolated-test-token'));
  await page.goto('/labels');
  await expect(page.getByRole('heading', { name: '当前标签' })).toBeVisible();
  await expect(page.locator('.ant-spin-spinning')).toHaveCount(0);
}

test('标准标签按三点码元排版，保留四格留白，长码及长文字禁止缩小打印', () => {
  const layout = createLabelLayout(task);
  expect(layout.error).toBeUndefined();
  expect(layout.qrSize).toBe(99);
  expect(DOTS_PER_MODULE).toBe(3);
  expect(QUIET_MODULES).toBe(4);
  expect(createLabelLayout({ ...task, labelCode: 'X'.repeat(200) }).error).toContain('标签码过长');
  expect(createLabelLayout({ ...task, animalNo: 'ANIMAL'.repeat(20) }).error).toContain('标签文字过长');
});

test.describe('300 dpi 打印输出', () => {
  test.use({ deviceScaleFactor: 300 / 96 });

  test('页面多张预览只打印当前一张，输出 25 × 10 mm 的单页文件', async ({ page }) => {
    await openLabels(page);
    await page.locator('.label-card-button').nth(1).click();
    await expect(page.locator('#label-print-root .label-preview')).toHaveAttribute('data-label-code', second.labelCode);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('#root')).toBeHidden();
    await expect(page.locator('.label-preview:visible')).toHaveCount(1);
    const box = await page.locator('#label-print-root').boundingBox();
    expect(box!.width).toBeCloseTo(25 * 96 / 25.4, 1);
    expect(box!.height).toBeCloseTo(10 * 96 / 25.4, 1);
    await page.locator('#label-print-root').screenshot({ path: 'test-results/label-300dpi.png' });
    await page.pdf({ path: 'test-results/label-25x10mm.pdf', preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  });
});

test('搜索后同步当前标签，空结果不可打印旧标签', async ({ page }) => {
  await openLabels(page);
  const search = page.getByPlaceholder('标签码、动物号、项目号');
  await search.fill('第二张');
  await search.press('Enter');
  await expect(page.locator('#label-print-root .label-preview')).toHaveAttribute('data-label-code', second.labelCode);
  await search.fill('空结果');
  await search.press('Enter');
  await expect(page.getByRole('button', { name: '打印当前标签' })).toBeDisabled();
  await expect(page.locator('#label-print-root')).toHaveCount(0);
});

test('查询失败和超长标签均不可打印', async ({ page }) => {
  await openLabels(page, [{ ...task, labelCode: 'X'.repeat(200) }]);
  await expect(page.getByRole('button', { name: '打印当前标签' })).toBeDisabled();
  await expect(page.locator('.sticky-preview')).toContainText('标签码过长');
  await page.route(/^http:\/\/127\.0\.0\.1:5175\/api\/sample-tasks/, (route) => route.fulfill({ status: 500, json: { code: 500, message: '测试加载失败' } }));
  await page.getByPlaceholder('标签码、动物号、项目号').press('Enter');
  await expect(page.locator('.sticky-preview')).toContainText('请选择标签');
  await expect(page.getByRole('button', { name: '打印当前标签' })).toBeDisabled();
});

test('较早查询晚返回时不能替换最新的打印标签', async ({ page }) => {
  await openLabels(page);
  let releaseFirst = () => {};
  const blocked = new Promise<void>((resolve) => { releaseFirst = resolve; });
  await page.route(/^http:\/\/127\.0\.0\.1:5175\/api\/sample-tasks/, async (route) => {
    if (new URL(route.request().url()).searchParams.get('keyword') !== '慢查询') return route.fallback();
    await blocked;
    await route.fulfill({ json: { code: 200, data: [task] } });
  });
  const search = page.getByPlaceholder('标签码、动物号、项目号');
  await search.fill('慢查询');
  await search.press('Enter');
  await expect(page.getByRole('button', { name: '打印当前标签' })).toBeDisabled();
  await search.fill('第二张');
  await search.press('Enter');
  await expect(page.locator('#label-print-root .label-preview')).toHaveAttribute('data-label-code', second.labelCode);
  const response = page.waitForResponse((item) => new URL(item.url()).searchParams.get('keyword') === '慢查询');
  releaseFirst();
  await response;
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator('#label-print-root .label-preview')).toHaveAttribute('data-label-code', second.labelCode);
});
