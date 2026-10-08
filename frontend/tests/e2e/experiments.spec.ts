import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

const experiment = {
  id: 7,
  projectCode: 'DEMO-001',
  projectName: '实验演示',
  status: 'ACTIVE',
};
const purpose = {
  id: 'p1',
  projectId: 7,
  name: '药代',
  collectionKeywords: ['全血'],
  aliquotKeywords: ['血浆'],
  confirmed: true,
  active: true,
  version: 1,
  createdAt: '2026-10-05T00:00:00Z',
};
const tube = {
  id: 't1',
  projectId: 7,
  projectCode: 'DEMO-001',
  kind: 'COLLECTION',
  animalNo: '001',
  timePoint: '1h',
  labelInfo: '全血',
  collectDate: '2026-10-05',
  purposeId: 'p1',
  confirmed: true,
  sourceTubeId: '',
  code: 'Eabcdefghijklmnopqrstuv',
  barcode: '000000000101',
  status: 'ACTIVE',
  printed: false,
  version: 1,
  replacesId: '',
  createdAt: '2026-10-05T00:00:00Z',
};
const aliquot = {
  ...tube,
  id: 't2',
  kind: 'ALIQUOT',
  labelInfo: '血浆',
  sourceTubeId: 't1',
  code: 'EABCDEFGHIJKLMNOPQRSTUV',
  barcode: '000000000102',
};
const session = {
  id: 's1',
  projectId: 7,
  ownerId: 1,
  stage: 'COLLECTION',
  collectDate: tube.collectDate,
  timePoint: '1h',
  purposeId: 'p1',
  purposeSnapshot: purpose,
  round: 1,
  state: 'IN_PROGRESS',
  pending: 'CHIP',
  createdAt: tube.createdAt,
};
const batch = {
  id: 'b1',
  projectId: 7,
  kind: 'COLLECTION',
  fileName: '采血.xlsx',
  hash: 'hash',
  size: 20,
  createdAt: tube.createdAt,
  status: 'PREVIEW',
  duplicate: false,
  rows: [
    {
      rowKey: 'Sheet1:2',
      sourceSheet: 'Sheet1',
      sourceRow: 2,
      projectId: 7,
      projectCode: 'DEMO-001',
      animalNo: '001',
      timePoint: '1h',
      labelInfo: '全血',
      collectDate: tube.collectDate,
      suggestedPurposeId: 'p1',
    },
  ],
  issues: [],
};
type Body = Record<string, unknown>;
type Handler = (
  path: string,
  body: Body,
  method: string,
  query: URLSearchParams,
) => unknown | Promise<unknown>;
async function open(
  page: Page,
  tab = 'groups',
  handler?: Handler,
  permissions = ['*'],
  modelSessionWrites = true,
) {
  let savedSession: unknown;
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
  await page.route(/^http:\/\/127\.0\.0\.1:5175\/api\//, async (route) => {
    const u = new URL(route.request().url());
    const method = route.request().method();
    const body =
      method === 'POST' && !route.request().headers()['content-type']?.includes('multipart')
        ? (route.request().postDataJSON() as Body)
        : {};
    const override = await handler?.(u.pathname, body, method, u.searchParams);
    if (override === 'NETWORK') return route.abort('failed');
    if (override && typeof override === 'object' && 'httpStatus' in override)
      return route.fulfill({
        status: (override as { httpStatus: number }).httpStatus,
        json: { code: 409, message: '重复内容，请明确确认追加' },
      });
    let data: unknown = override;
    if (data === undefined) {
      data = [];
      if (u.pathname === '/api/auth/me')
        data = {
          id: 1,
          username: 'tester',
          realName: '测试员',
          roles: [],
          permissions,
        };
      else if (u.pathname === '/api/menus/routes')
        data = [
          {
            id: 1,
            parentId: 0,
            menuKey: 'experiments',
            routePath: '/experiments',
            menuName: '实验列表',
            component: 'ExperimentsPage',
            visible: true,
            status: 'ENABLED',
            children: [],
          },
        ];
      else if (u.pathname === '/api/experiments') data = [experiment];
      else if (u.pathname.endsWith('/purposes')) data = [purpose];
      else if (u.pathname.endsWith('/tubes')) data = [tube, aliquot];
      else if (u.pathname.endsWith('/mappings'))
        data = [
          {
            id: 'm1',
            animalNo: '001',
            chipNo: '0000123',
            active: true,
            version: 1,
          },
        ];
      else if (u.pathname.endsWith('/sessions/current')) data = {};
      else if (u.pathname.endsWith('/imports/preview') || u.pathname.endsWith('/imports/b1'))
        data = batch;
      else if (u.pathname.endsWith('/sessions')) data = session;
    }
    // Normal fixtures model committed state as well as the operation response.
    // Cache-response regressions disable this and supply current state explicitly.
    if (
      modelSessionWrites &&
      method === 'POST' &&
      data &&
      typeof data === 'object' &&
      'pending' in data
    )
      savedSession = data;
    if (
      modelSessionWrites &&
      method === 'GET' &&
      u.pathname.endsWith('/sessions/current') &&
      savedSession
    )
      data = savedSession;
    await route.fulfill({ json: { code: 200, data } });
  });
  await page.addInitScript(() => localStorage.setItem('tag-management-token', 'test-token'));
  await page.goto(`/experiments?experiment=7&tab=${tab}`);
  await expect(page.getByRole('heading', { name: 'DEMO-001 · 实验演示' })).toBeVisible();
}
async function navigateWorkspace(page: Page, name: string) {
  const nav = page.getByRole('navigation', { name:'实验内导航' });
  const toggle = nav.getByRole('button', { name:/实验导航/ });
  if (await toggle.isVisible() && await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
  if (['工作台','采血核对','血样处理核对'].includes(name)) {
    await nav.getByRole('button', {name,exact:true}).click();
  } else {
    await nav.getByRole('button',{name:/核对记录|更改记录/.test(name)?'追溯记录':'实验准备',exact:true}).click();
    await page.getByRole('menuitem',{name,exact:true}).click();
  }
}
async function context(page: Page) {
  await page.getByLabel('采样日期', { exact: true }).selectOption('2026-10-05');
  await page.getByLabel('时间点', { exact: true }).selectOption('1h');
  await page.getByLabel('本次用途', { exact: true }).selectOption('p1');
}
async function upload(page: Page) {
  await page.getByLabel('上传 Excel 附件').setInputFiles({
    name: '采血.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('fixture'),
  });
}

test('HTTP环境没有randomUUID时可保存实验，刷新重试保留原请求编号', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  const bodies: Body[] = [];
  const created = { ...experiment, id: 8, projectCode: 'HTTP-001', projectName: 'HTTP实验' };
  let saved = false;
  await open(page, 'overview', (path, body, method) => {
    if (path !== '/api/experiments') return;
    if (method === 'POST') {
      bodies.push(body);
      saved = true;
      if (bodies.length === 1) return 'NETWORK';
      return created;
    }
    return saved ? [created, experiment] : [experiment];
  });
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByRole('button', { name: '添加实验', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '添加实验' });
  await dialog.getByLabel('试验编号', { exact: true }).fill('HTTP-001');
  await dialog.getByLabel('实验名称', { exact: true }).fill('HTTP实验');
  await dialog.getByRole('button', { name: '保存实验' }).click();
  await expect(dialog.getByRole('button', { name: '重试原操作' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect(page.getByRole('heading', { name: 'HTTP-001 · HTTP实验', exact: true })).toBeVisible();
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[0].requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await expect(page.getByRole('button', { name: '添加实验', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加实验', exact: true })).toBeEnabled();
});

test('HTTP环境没有randomUUID时附件可预览，重试使用同一请求编号', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined, configurable: true });
  });
  await open(page, 'imports');
  const requestIds: string[] = [];
  await page.route('**/api/experiments/7/imports/preview', async (route) => {
    const multipart = route.request().postDataBuffer()?.toString('utf8') || '';
    requestIds.push(multipart.match(/name="requestId"\r\n\r\n([^\r]+)/)?.[1] || '');
    if (requestIds.length === 1) return route.abort('failed');
    await route.fulfill({ json: { code: 200, data: batch } });
  });
  await upload(page);
  await page.getByRole('button', { name: '重试原附件预览' }).click();
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).toHaveValue('p1');
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  expect(requestIds[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('工作台首页默认突出两个核对入口，入口导航不创建会话', async ({ page }) => {
  let starts = 0;
  await open(page, '', (path, _body, method) => {
    if (path.endsWith('/sessions') && method === 'POST') starts++;
  });
  await expect(page.getByRole('heading', { name: '选择现场核对任务' })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入采血核对', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入血样处理核对', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '进入采血核对', exact: true }).click();
  await expect(page).toHaveURL(/tab=collection$/);
  await expect(page.getByLabel('扫描内容')).toBeDisabled();
  await page.getByRole('navigation', { name: '实验内导航' }).getByRole('button', { name: '工作台', exact: true }).click();
  await page.getByRole('button', { name: '进入血样处理核对', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=aliquot$/);
  await expect(page.getByLabel('扫描内容')).toBeDisabled();
  expect(starts).toBe(0);
});

test('顶部导航分组且保留资料深链接与前进后退', async ({ page }) => {
  await open(page,'collection-tubes');
  for (const name of ['实验准备','追溯记录','采血核对']) await expect(page.getByRole('navigation',{name:'实验内导航'}).getByRole('button',{name,exact:true})).toBeVisible();
  await navigateWorkspace(page,'用途配对');
  await expect(page).toHaveURL(/tab=purposes$/);
  await page.goBack();
  await expect(page.getByRole('heading',{name:'采血管列表'})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading',{name:'用途与允许配对规则'})).toBeVisible();
  await page.goto('/experiments?experiment=7&tab=unknown');
  await expect(page.getByRole('heading',{name:'选择现场核对任务'})).toBeVisible();
});

test('移动端键盘选择顶部导航后折叠并恢复可见焦点', async ({ page }) => {
  await page.setViewportSize({width:375,height:812});
  await open(page,'overview');
  const nav = page.getByRole('navigation',{name:'实验内导航'});
  const toggle = nav.getByRole('button',{name:/实验导航/});
  await toggle.focus(); await page.keyboard.press('Enter');
  await nav.getByRole('button',{name:'实验准备',exact:true}).click();
  await page.getByRole('menuitem',{name:'分组关系',exact:true}).focus(); await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/tab=groups$/);
  await expect(toggle).toHaveAttribute('aria-expanded','false');
  await expect(toggle).toBeFocused();
  await page.setViewportSize({width:1440,height:1000});
  await expect(toggle).toBeHidden();
  await navigateWorkspace(page,'用途配对');
  await expect(page).toHaveURL(/tab=purposes$/);
});

test('选择实验默认回工作台，无核对权限入口禁用并说明原因', async ({ page }) => {
  await open(page, 'groups', undefined, ['project:view']);
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByRole('button', { name: '进入实验', exact: true }).click();
  await expect(page).toHaveURL(/tab=overview$/);
  await expect(page.getByRole('button', { name: '进入采血核对', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '进入血样处理核对', exact: true })).toBeDisabled();
  await expect(page.getByText('当前账号没有采血核对操作权限', { exact: true })).toBeVisible();
  await expect(page.getByText('当前账号没有血样处理核对操作权限', { exact: true })).toBeVisible();
});

for (const state of ['IN_PROGRESS', 'FAILED']) {
  test(`工作台提供${state}当前核对恢复且刷新后仍可返回`, async ({ page }) => {
    await open(page, 'overview', (path) => path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')
      ? { ...session, state } : undefined);
    await expect(page.getByRole('button', { name: '继续当前核对', exact: true })).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: '继续当前核对', exact: true }).click();
    await expect(page).toHaveURL(/experiment=7&tab=collection$/);
    await expect(page.getByTestId('scan-state')).toContainText(state === 'FAILED' ? '核对失败' : '扫描动物芯片');
  });
}

test('其他实验失败轮在首页保持醒目并返回原实验，入口不跳过门禁', async ({ page }) => {
  const other = { ...experiment, id: 8, projectCode: 'OTHER-008', projectName: '另一实验' };
  let starts = 0;
  await open(page, 'overview', (path, _body, method) => {
    if (path === '/api/experiments') return [experiment, other];
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return { ...session, state: 'FAILED' };
    if (path.endsWith('/sessions') && method === 'POST') starts++;
  });
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByLabel('选择实验', { exact: true }).selectOption('8');
  await expect(page.getByText(/当前账号有未解决的失败核对：DEMO-001/)).toBeVisible();
  await page.getByRole('button', { name: '进入血样处理核对', exact: true }).click();
  await expect(page.getByRole('button', { name: '开始血样处理核对', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '返回失败核对', exact: true }).click();
  await expect(page).toHaveURL(/experiment=7&tab=collection$/);
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  expect(starts).toBe(0);
});

test('资料未加载成功不显示虚假数量', async ({ page }) => {
  await open(page, 'overview', (path) => path.endsWith('/mappings') ? 'NETWORK' : undefined);
  await expect(page.getByRole('button', { name: '重新加载实验资料', exact: true })).toBeVisible();
  await expect(page.getByText('实验资料概览', { exact: true })).toHaveCount(0);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
  test(`工作台${viewport.width}px布局与完整截图`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await open(page, 'overview');
    const nav = page.getByRole('navigation', { name: '实验内导航' });
    const capture = async (name: string) => {
      const widths = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        workspace: document.querySelector('.workspace-main')!.scrollWidth,
        available: document.querySelector('.workspace-main')!.clientWidth,
      }));
      expect(widths.page).toBeLessThanOrEqual(widths.viewport);
      expect(widths.workspace).toBeLessThanOrEqual(widths.available);
      await page.screenshot({ path: process.env.LAYOUT_EVIDENCE_DIR
        ? resolve(process.env.LAYOUT_EVIDENCE_DIR, `${name}-${viewport.width}.png`)
        : testInfo.outputPath(`${name}-${viewport.width}.png`), fullPage: true, animations: 'disabled' });
    };
    await capture('overview');
    await page.getByRole('button', { name: '进入采血核对', exact: true }).click();
    await context(page);
    await page.getByRole('button', { name: '开始采血核对', exact: true }).click();
    await expect(page.getByTestId('scan-state')).toContainText('扫描动物芯片');
    await expect(page.getByLabel('扫描内容', { exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '提交扫描', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: '提交扫描', exact: true })).toHaveCSS('background-color', 'rgb(23, 87, 194)');
    await capture('scan');
    if (viewport.width < 1000) {
      await nav.getByRole('button', { name: /实验导航/ }).click();
      await expect(nav.getByRole('button', { name: /实验导航/ })).toHaveAttribute('aria-expanded', 'true');
    }
    await navigateWorkspace(page,'分组关系');
    await expect(page.getByRole('heading', { name: '动物与芯片分组关系', exact: true })).toBeVisible();
    await capture('preparation');
    if (viewport.width < 1000) {
      await expect(nav.getByRole('button', { name: /实验导航/ })).toHaveAttribute('aria-expanded', 'false');
    }
  });
}

test('长中文实验名称在窄屏完整换行并保留两个入口', async ({ page }) => {
  await open(page, 'overview');
  await page.setViewportSize({ width: 375, height: 812 });
  const longName = '实验演示：重复给药后药代动力学与血样处理关系核对及全过程追溯验证';
  await page.route('**/api/experiments', (route) => route.fulfill({ json: { code: 200, data: [{ ...experiment, projectName: longName }] } }));
  await page.reload();
  await expect(page.getByRole('heading', { name: `${experiment.projectCode} · ${longName}`, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入采血核对', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入血样处理核对', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('.experiment-workspace')!.scrollWidth)).toBeLessThanOrEqual(351);
});

test('实验选择和当前工作页在刷新后保留，窄屏仍能打开导航', async ({ page }) => {
  await open(page);
  await navigateWorkspace(page,'采血管');
  await page.reload();
  await expect(page.getByRole('heading',{name:'采血管列表'})).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await navigateWorkspace(page,'工作台');
  await expect(page.getByRole('button',{name:'返回实验列表',exact:true})).toBeVisible();
});
test('开始采血要求独立选择日期时间点用途', async ({ page }) => {
  let starts = 0;
  await open(page, 'collection', (path) => {
    if (path.endsWith('/sessions')) starts++;
  });
  await page.getByRole('button', { name: '开始采血核对' }).click();
  await expect(page.getByText('请选择采样日期', { exact: true })).toBeVisible();
  expect(starts).toBe(0);
  await page.getByLabel('采样日期', { exact: true }).selectOption(tube.collectDate);
  await page.getByRole('button', { name: '开始采血核对' }).click();
  await expect(page.getByText('请选择时间点', { exact: true })).toBeVisible();
  await page.getByLabel('时间点', { exact: true }).selectOption('1h');
  await page.getByRole('button', { name: '开始采血核对' }).click();
  await expect(page.getByText('请选择本次用途', { exact: true })).toBeVisible();
});
test('错误会话刷新恢复且不能跳到下一轮，异常关闭必须原因并明确确认', async ({ page }) => {
  let closed: Body | undefined;
  const failed = {
    ...session,
    state: 'FAILED',
    pending: 'COLLECTION_TUBE',
    animalNo: '001',
    lastResult: {
      id: 'e1',
      result: 'FAIL',
      message: '采样日期不匹配',
      actual: { ...tube, collectDate: '2026-10-04' },
    },
  };
  await open(page, 'collection', (path, body) => {
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return failed;
    if (path.endsWith('/exception-close')) {
      closed = body;
      return {
        ...failed,
        state: 'ABORTED',
        pending: 'NONE',
        lastResult: { id: 'e2', result: 'ABORT', remark: body.remark },
      };
    }
  });
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  await expect(page.getByText('采样日期不匹配', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  await page.getByRole('button', { name: '确认异常结束' }).click();
  await expect(page.getByText('请填写异常结束原因', { exact: true })).toBeVisible();
  await page.getByLabel('异常结束原因').fill('取错管，停止本轮');
  await page.getByRole('button', { name: '确认异常结束' }).click();
  await expect(page.getByRole('dialog')).toContainText('不计为通过');
  await page.getByRole('dialog').getByRole('button', { name: '明确确认结束' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('异常结束');
  expect(closed?.confirmed).toBe(true);
  expect(closed?.remark).toBe('取错管，停止本轮');
});
test('HTTP200 FAIL不显示通过；纠正后服务端PASS才允许下一轮，旧PASS不污染新一轮', async ({
  page,
}) => {
  let chip = false;
  await open(page, 'collection', (path, body) => {
    if (path.endsWith('/chip')) {
      chip = true;
      return {
        ...session,
        pending: 'COLLECTION_TUBE',
        animalNo: '001',
        chipContent: body.content,
      };
    }
    if (path.endsWith('/tube'))
      return {
        ...session,
        pending: body.content === 'WRONG' ? 'COLLECTION_TUBE' : 'NONE',
        state: body.content === 'WRONG' ? 'FAILED' : 'PASSED',
        lastResult: {
          id: 'e1',
          round: 1,
          result: body.content === 'WRONG' ? 'FAIL' : 'PASS',
          message: body.content === 'WRONG' ? '动物不符' : '关系一致',
          actual: tube,
        },
      };
    if (path.endsWith('/next'))
      return {
        ...session,
        round: 2,
        lastResult: { id: 'e1', round: 1, result: 'PASS' },
      };
  });
  await context(page);
  await page.getByRole('button', { name: '开始采血核对' }).click();
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  expect(chip).toBe(true);
  await page.getByLabel('扫描内容').fill('WRONG');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
  await page.getByLabel('扫描内容').fill(tube.code);
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('核对通过');
  await page.getByRole('button', { name: '下一轮' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('扫描动物芯片');
  await expect(page.getByTestId('scan-state')).not.toContainText('核对通过');
});
test('网络结果不明确保留原码，同一requestId重试，忙时不可重复扫码', async ({ page }) => {
  const bodies: Body[] = [];
  await open(page, 'collection', (path, body) => {
    if (path.endsWith('/chip')) {
      bodies.push(body);
      if (bodies.length === 1) return 'NETWORK';
      return { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' };
    }
    if (path.endsWith('/sessions/s1')) return session;
  });
  await context(page);
  await page.getByRole('button', { name: '开始采血核对' }).click();
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByText(/结果未确认/).first()).toBeVisible();
  await expect(page.getByLabel('扫描内容')).toHaveValue('0000123');
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  expect(bodies[0]).toEqual(bodies[1]);
  await expect(page.getByLabel('扫描内容')).toHaveValue('');
});
test('分装具体来源无采血PASS时服务器拒绝，不能扫分装管', async ({ page }) => {
  await open(page, 'aliquot', (path) => {
    if (path.endsWith('/sessions')) return { ...session, stage: 'ALIQUOT', pending: 'SOURCE_TUBE' };
    if (path.endsWith('/tube'))
      return {
        ...session,
        stage: 'ALIQUOT',
        state: 'FAILED',
        pending: 'SOURCE_TUBE',
        lastResult: {
          id: 'e1',
          result: 'FAIL',
          message: '该来源管尚未完成采血核对',
          actual: tube,
        },
      };
  });
  await context(page);
  await page.getByRole('button', { name: '开始血样处理核对' }).click();
  await page.getByLabel('扫描内容').fill(tube.code);
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByText('该来源管尚未完成采血核对', { exact: true })).toBeVisible();
  await expect(page.getByTestId('scan-state')).toContainText('扫描来源采血管');
  await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
});
test('导入错误指出附件工作表行列，禁止部分提交', async ({ page }) => {
  await open(page, 'imports', (path) =>
    path.endsWith('/imports/preview')
      ? {
          ...batch,
          status: 'INVALID',
          issues: [
            {
              sheet: 'Sheet2',
              row: 4,
              column: '采样日期',
              message: '日期格式错误',
            },
          ],
        }
      : undefined,
  );
  await upload(page);
  await expect(page.getByText('日期格式错误', { exact: true })).toBeVisible();
  await expect(page.getByTestId('import-issues')).toContainText('Sheet2');
  await expect(page.getByTestId('import-issues')).toContainText('4');
  await expect(page.getByRole('button', { name: '确认用途并追加导入' })).toBeDisabled();
});

test('新实验导入显示编号与分组用途前提', async ({ page }) => {
  await open(page, 'imports', (path) =>
    path.endsWith('/mappings') || path.endsWith('/purposes') || path.endsWith('/tubes') ? [] : undefined,
  );
  await expect(page.getByText('附件中的试验编号必须为 DEMO-001', { exact: true })).toBeVisible();
  await expect(page.getByText('当前实验尚无有效分组，请先上传分组表并确认导入。', { exact: true })).toBeVisible();
  await expect(page.getByText('当前实验尚无已确认用途，请先在“用途配对”中设置。', { exact: true })).toBeVisible();
  await page.getByLabel('附件类型', { exact: true }).selectOption('GROUP');
  await expect(page.getByText('当前实验尚无有效分组，请先上传分组表并确认导入。', { exact: true })).not.toBeVisible();
});

test('导入批量用途能跨页选中全部45行并提交', async ({ page }) => {
  const rows = Array.from({ length: 45 }, (_, i) => ({
    ...batch.rows[0], rowKey: `Sheet1:${i + 2}`, sourceRow: i + 2,
    animalNo: String(i + 1).padStart(3, '0'), suggestedPurposeId: '',
  }));
  let submitted: Body | undefined;
  await open(page, 'imports', (path, body) => {
    if (path.endsWith('/imports/preview')) return { ...batch, rows };
    if (path.endsWith('/commit')) {
      submitted = body;
      return { ...batch, rows, status: 'COMMITTED' };
    }
  });
  await upload(page);
  await page.getByRole('button', { name: '全选本批全部45行', exact: true }).click();
  await page.getByLabel('批量用途', { exact: true }).selectOption('p1');
  await page.getByRole('button', { name: '应用到选中行（45）', exact: true }).click();
  await expect(page.getByRole('button', { name: '确认用途并追加导入' })).toBeEnabled();
  await page.getByRole('button', { name: '确认用途并追加导入' }).click();
  await expect(page.getByText('已完整导入', { exact: true }).first()).toBeVisible();
  expect(submitted?.assignments).toEqual(rows.map((r) => ({ rowKey: r.rowKey, purposeId: 'p1' })));
});
test('提交409重新取最新疑似重复行，明确追加才新请求提交', async ({ page }) => {
  const commits: Body[] = [];
  let conflict = false;
  await open(page, 'imports', (path, body) => {
    if (path.endsWith('/commit')) {
      commits.push(body);
      if (commits.length === 1) {
        conflict = true;
        return { httpStatus: 409 };
      }
      return { ...batch, status: 'COMMITTED', entityIds: ['t3'] };
    }
    if (path.endsWith('/imports/b1') && conflict)
      return {
        ...batch,
        duplicateRows: [
          {
            rowKey: 'Sheet1:2',
            tubeId: 't1',
            importId: 'old-batch',
            sourceSheet: '原表',
            sourceRow: 9,
            content: batch.rows[0],
          },
        ],
      };
  });
  await upload(page);
  await page.getByRole('button', { name: '确认用途并追加导入' }).click();
  await expect(page.getByTestId('duplicate-candidates')).toContainText('old-batch');
  await expect(page.getByRole('button', { name: '确认用途并追加导入' })).toBeDisabled();
  await page.getByLabel('我确认以上疑似重复内容仍需追加，每行创建独立管子').check();
  await page.getByRole('button', { name: '确认用途并追加导入' }).click();
  await expect(page.getByText('已完整导入', { exact: true }).first()).toBeVisible();
  expect(commits[1].acknowledgeDuplicate).toBe(true);
  expect(commits[0].requestId).not.toBe(commits[1].requestId);
});
test('已提交分装批次回看显示最终用途和明确来源，停用作废后仍保留身份', async ({ page }) => {
  const finalPurpose = { ...purpose, id: 'p2', name: '生化' };
  const sourceA = { ...tube, id: 'source-a', purposeId: 'p2' };
  const sourceB = { ...sourceA, id: 'source-b', labelInfo: '生化原血' };
  const previewBatch = { ...batch, kind: 'ALIQUOT', rows: [{ ...batch.rows[0], labelInfo: '血浆' }] };
  let saved: typeof previewBatch & { confirmedRows?: Body[] } = previewBatch;
  let committed = false;
  let archived = false;
  let reopened = 0;
  await open(page, 'imports', (path, body, method) => {
    if (path.endsWith('/purposes'))
      return [purpose, { ...finalPurpose, active: !archived }];
    if (path.endsWith('/tubes'))
      return [sourceA, { ...sourceB, status: archived ? 'VOID' : 'ACTIVE' }];
    if (path.endsWith('/imports/preview')) return previewBatch;
    if (path.endsWith('/imports')) return [saved];
    if (path.endsWith('/commit')) {
      expect(body.confirmed).toBe(true);
      expect(body.assignments).toEqual([
        { rowKey: 'Sheet1:2', purposeId: 'p2', sourceTubeId: 'source-b' },
      ]);
      committed = true;
      saved = {
        ...previewBatch,
        status: 'COMMITTED',
        confirmedRows: [{ ...previewBatch.rows[0], purposeId: 'p2', sourceTubeId: 'source-b', confirmed: true }],
      };
      return saved;
    }
    if (path.endsWith('/imports/b1') && method === 'GET') {
      reopened++;
      return saved;
    }
  });
  await upload(page);
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).toHaveValue('p1');
  await page.getByLabel('用途 Sheet1:2', { exact: true }).selectOption('p2');
  await expect(page.getByLabel('来源 Sheet1:2', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: '确认用途并追加导入' })).toBeDisabled();
  await page.getByLabel('来源 Sheet1:2', { exact: true }).selectOption('source-b');
  await page.getByRole('button', { name: '确认用途并追加导入' }).click();
  await expect(page.getByText('已完整导入', { exact: true }).first()).toBeVisible();
  expect(committed).toBe(true);
  archived = true;
  await page.reload();
  await page.getByRole('button', { name: '查看批次' }).click();
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).toContainText('生化');
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).toContainText('p2');
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).toContainText('已停用');
  await expect(page.getByLabel('来源 Sheet1:2', { exact: true })).toContainText('生化原血');
  await expect(page.getByLabel('来源 Sheet1:2', { exact: true })).toContainText('source-b');
  await expect(page.getByLabel('来源 Sheet1:2', { exact: true })).toContainText('已作废');
  await expect(page.getByLabel('用途 Sheet1:2', { exact: true })).not.toHaveJSProperty('tagName', 'SELECT');
  await expect(page.getByLabel('来源 Sheet1:2', { exact: true })).not.toHaveJSProperty('tagName', 'SELECT');
  await expect(page.getByRole('button', { name: '确认用途并追加导入' })).toBeDisabled();
  await expect(page.getByText('有分装行的来源不唯一或缺失，请明确选择来源采血管。')).toHaveCount(0);
  expect(reopened).toBe(1);
});
test('用途归类与歧义配对批量确认，保存响应后刷新新管身份', async ({ page }) => {
  let assignment: Body | undefined;
  await open(page, 'aliquot-tubes', (path, body) => {
    if (path.endsWith('/tube-assignments')) {
      assignment = body;
      return {
        tubes: [{ ...aliquot, id: 'replacement', barcode: '000000000103', code: 'E1234567890123456789012' }],
      };
    }
    if (path.endsWith('/tubes'))
      return [
        tube,
        { ...tube, id: 't3', barcode: '000000000104', code: 'E1234567890123456789013' },
        {
          ...aliquot,
          confirmed: false,
          purposeId: undefined,
          sourceTubeId: '',
        },
      ];
  });
  await page.getByRole('checkbox', { name: '选择管子 t2' }).check();
  await page.getByLabel('批量用途').selectOption('p1');
  await page.getByLabel('批量来源采血管').selectOption('t1');
  await page.getByLabel('批量更正原因').fill('确认对应来源');
  await page.getByRole('button', { name: '确认批量归类与配对' }).click();
  await expect(page.getByText(/批量更正已保存/)).toBeVisible();
  expect(assignment?.confirmed).toBe(true);
  expect(assignment?.assignments).toEqual([{ tubeId: 't2', purposeId: 'p1', sourceTubeId: 't1' }]);
});
test('管子内容更正需原因，说明旧码作废，新增与同管补打区分', async ({ page }) => {
  let edit: Body | undefined;
  await open(page, 'collection-tubes', (path, body, method) => {
    if (path.endsWith('/tubes/t1') && method === 'POST') {
      edit = body;
      return {
        ...tube,
        id: 'new-id',
        barcode: '000000000103', code: 'E1234567890123456789012',
        replacesId: 't1',
      };
    }
  });
  await page.getByRole('button', { name: '更正 t1' }).click();
  await expect(page.getByRole('dialog')).toContainText('旧标签码将作废');
  await page.getByRole('dialog').getByLabel('管标信息').fill('更正全血');
  await page.getByRole('dialog').getByRole('button', { name: '保存更正' }).click();
  await expect(page.getByText('请填写原因', { exact: true })).toBeVisible();
  await page.getByRole('dialog').getByLabel('更正原因').fill('标签内容错误');
  await page.getByRole('dialog').getByRole('button', { name: '保存更正' }).click();
  await expect(page.getByText(/new-id/).first()).toBeVisible();
  expect(edit?.labelInfo).toBe('更正全血');
  expect(edit?.reason).toBe('标签内容错误');
});
test('标签全部五字段完整预览，溢出逐管诊断禁止打印', async ({ page }) => {
  await open(page, 'print', (path) =>
    path.endsWith('/tubes')
      ? [
          tube,
          {
            ...tube,
            id: 'long',
            barcode: '000000000103', code: 'E1234567890123456789012',
            labelInfo: '完整保留的超长原始管标信息'.repeat(20),
          },
        ]
      : undefined,
  );
  await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
  const artwork = page.locator('[data-tube-id="t1"] svg');
  for (const text of [
    tube.projectCode,
    tube.animalNo,
    tube.timePoint,
    tube.labelInfo,
    tube.collectDate,
  ])
    await expect(artwork).toContainText(text);
  await page.getByRole('checkbox', { name: '选择标签 long' }).check();
  await expect(page.getByTestId('label-overflows')).toContainText('long');
  await expect(page.getByRole('button', { name: '登记打印请求并打开打印' })).toBeDisabled();
});
test('批量打印每支独立25x10mm页，只登记请求，补打保持条形码', async ({ page }) => {
  let printed: Body | undefined;
  await open(page, 'print', (path, body, method) => {
    if (path.endsWith('/print-requests') && method === 'POST') {
      printed = body;
      return {
        id: 'print1',
        status: 'REQUEST_ACKNOWLEDGED',
        tubes: [tube, aliquot],
        createdAt: tube.createdAt,
      };
    }
  });
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
  await page.getByRole('checkbox', { name: '选择标签 t2' }).check();
  await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
  await expect(page.getByText(/已登记打印请求/).first()).toBeVisible();
  expect(printed?.tubeIds).toEqual(['t1', 't2']);
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#experiment-print-root .experiment-print-page')).toHaveCount(2);
  const box = await page
    .locator('#experiment-print-root .experiment-print-page')
    .first()
    .boundingBox();
  expect(box?.width).toBeCloseTo((25 * 96) / 25.4, 1);
  expect(box?.height).toBeCloseTo((10 * 96) / 25.4, 1);
  await page.pdf({
    path: 'test-results/experiment-batch-25x10mm.pdf',
    preferCSSPageSize: true,
    printBackground: true,
  });
});
test('追溯筛选与CSV保持相同条件，详情使用不可变快照和上海时间', async ({ page }) => {
  const event = {
    id: 'e1',
    projectId: 7,
    projectSnapshot: experiment,
    action: 'TUBE_SCAN',
    result: 'FAIL',
    actorName: '测试员',
    createdAt: '2026-10-05T00:00:00Z',
    actual: { ...tube, labelInfo: '原始旧管标' },
    expected: {
      mappingSnapshot: { version: 1, chipNo: '旧芯片' },
      sourceSnapshot: tube,
    },
    remark: '异常说明',
  };
  let filtered = false;
  await open(page, 'records', (path, _body, _method, query) => {
    if (path.endsWith('/records')) {
      if (query.get('animalNo') === '001' && query.get('result') === 'FAIL') filtered = true;
      return [event];
    }
    if (path.endsWith('/records/e1')) return event;
  });
  await page.getByLabel('筛选动物号').fill('001');
  await page.getByLabel('筛选结果').selectOption('FAIL');
  await page.getByRole('button', { name: '查询记录' }).click();
  expect(filtered).toBe(true);
  let exportQuery = new URLSearchParams();
  await page.route(/\/api\/experiments\/7\/records\/export/, async (route) => {
    exportQuery = new URL(route.request().url()).searchParams;
    await route.fulfill({
      contentType: 'text/csv',
      headers: {
        'Content-Disposition':
          "attachment; filename*=UTF-8''%E6%A0%B8%E5%AF%B9%E8%AE%B0%E5%BD%95.csv",
      },
      body: '\ufeff动物号,结果\n001,FAIL\n',
    });
  });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出当前查询 CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('核对记录.csv');
  expect(exportQuery.get('animalNo')).toBe('001');
  expect(exportQuery.get('result')).toBe('FAIL');
  await page.getByRole('button', { name: '详情 e1' }).click();
  await expect(page.getByRole('dialog')).toContainText('原始旧管标');
  await expect(page.getByRole('dialog')).toContainText('旧芯片');
  await expect(page.getByRole('dialog')).toContainText('08:00:00');
});
test('无操作权限仍能看实验，扫码导入编辑打印入口不可操作', async ({ page }) => {
  await open(page, 'collection', undefined, ['project:view']);
  await expect(page.getByRole('button', { name: '开始采血核对' })).toBeDisabled();
  await navigateWorkspace(page, '附件导入');
  await expect(page.getByText('当前账号没有附件导入权限', { exact: true })).toBeVisible();
  await navigateWorkspace(page,'采血管');
  await expect(page.getByRole('button', { name: '新增采血管' })).toBeDisabled();
});

for (const previousState of ['IN_PROGRESS', 'PASSED']) {
  test(`${previousState}轮可明确重新选择日期时间用途，不能调用失败异常关闭`, async ({ page }) => {
    let startBody: Body | undefined;
    const old = {
      ...session,
      state: previousState,
      pending: previousState === 'PASSED' ? 'NONE' : 'CHIP',
      lastResult: previousState === 'PASSED' ? { id: 'pass', round: 1, result: 'PASS' } : undefined,
    };
    await open(page, 'collection', (path, body) => {
      if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return old;
      if (path.endsWith('/tubes'))
        return [
          tube,
          {
            ...tube,
            id: 'other-date',
            collectDate: '2026-10-06',
            timePoint: '2h',
          },
        ];
      if (path.endsWith('/sessions')) {
        startBody = body;
        return {
          ...session,
          id: 's2',
          collectDate: body.collectDate,
          timePoint: body.timePoint,
        };
      }
    });
    await expect(page.getByLabel('采样日期', { exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '确认异常结束' })).toBeDisabled();
    await page.getByRole('button', { name: '重新选择采样条件' }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认重新选择' }).click();
    await page.getByLabel('采样日期', { exact: true }).selectOption('2026-10-06');
    await page.getByLabel('时间点', { exact: true }).selectOption('2h');
    await page.getByLabel('本次用途', { exact: true }).selectOption('p1');
    await page.getByRole('button', { name: '开始采血核对' }).click();
    await expect(page.getByTestId('scan-state')).toContainText('扫描动物芯片');
    expect(startBody?.collectDate).toBe('2026-10-06');
    expect(startBody?.timePoint).toBe('2h');
  });
}
test('会话恢复失败时不能开始或扫码，重试读取服务端状态', async ({ page }) => {
  let unavailable = true;
  await open(page, 'collection', (path) =>
    path.endsWith('/sessions/current') ? (unavailable ? 'NETWORK' : {}) : undefined,
  );
  await expect(page.getByText(/未能恢复当前核对/)).toBeVisible();
  await expect(page.getByRole('button', { name: '开始采血核对' })).toBeDisabled();
  unavailable = false;
  await page.getByRole('button', { name: '重新恢复核对' }).click();
  await expect(page.getByRole('button', { name: '开始采血核对' })).toBeEnabled();
});
test('不确定扫码刷新后保留原操作与原码，重试不会生成新的身份', async ({ page }) => {
  const bodies: Body[] = [];
  await open(page, 'collection', (path, body) => {
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return session;
    if (path.endsWith('/chip')) {
      bodies.push(body);
      if (bodies.length === 1) return 'NETWORK';
      return { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' };
    }
  });
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByRole('button', { name: '重试原操作' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('扫描内容')).toHaveValue('0000123');
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  expect(bodies[0]).toEqual(bodies[1]);
});
test('扫描空白不发请求，延迟保存期间不能重复扫码', async ({ page }) => {
  let submitted = 0;
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await open(page, 'collection', async (path) => {
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return session;
    if (path.endsWith('/chip')) {
      submitted++;
      await wait;
      return { ...session, pending: 'COLLECTION_TUBE' };
    }
  });
  await page.getByLabel('扫描内容').fill('   ');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByText('请扫描或输入非空内容', { exact: true })).toBeVisible();
  expect(submitted).toBe(0);
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByRole('button', { name: '提交扫描' })).toBeDisabled();
  await expect(page.getByLabel('扫描内容')).toBeDisabled();
  release();
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  expect(submitted).toBe(1);
});
test('分装来源具体身份显示，连续下一支保留来源，换来源需重扫', async ({ page }) => {
  let retain: unknown;
  const s = { ...session, stage: 'ALIQUOT', pending: 'SOURCE_TUBE' };
  await open(page, 'aliquot', (path, body) => {
    if (path.endsWith('/sessions')) return s;
    if (path.endsWith('/tube'))
      return body.content === tube.code
        ? {
            ...s,
            pending: 'ALIQUOT_TUBE',
            sourceTubeId: tube.id,
            sourceSnapshot: tube,
            animalNo: '001',
          }
        : {
            ...s,
            state: 'PASSED',
            pending: 'NONE',
            sourceTubeId: tube.id,
            sourceSnapshot: tube,
            lastResult: {
              id: 'pass',
              round: 1,
              result: 'PASS',
              actual: aliquot,
            },
          };
    if (path.endsWith('/next')) {
      retain = body.retainSource;
      return {
        ...s,
        round: 2,
        pending: retain ? 'ALIQUOT_TUBE' : 'SOURCE_TUBE',
        ...(retain ? { sourceTubeId: tube.id, sourceSnapshot: tube } : {}),
        lastResult: { id: 'pass', round: 1, result: 'PASS' },
      };
    }
  });
  await context(page);
  await page.getByRole('button', { name: '开始血样处理核对' }).click();
  await page.getByLabel('扫描内容').fill(tube.code);
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByText('当前来源采血管（本轮快照）')).toBeVisible();
  await page.getByLabel('扫描内容').fill(aliquot.code);
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('核对通过');
  await page.getByRole('button', { name: '下一轮' }).click();
  expect(retain).toBe(true);
  await expect(page.getByTestId('scan-state')).toContainText('扫描分装管');
});
test('分组更正保留原因和历史，用途规则需要明确确认', async ({ page }) => {
  let mappingBody: Body | undefined;
  let purposeBody: Body | undefined;
  await open(page, 'groups', (path, body, method) => {
    if (path.endsWith('/mappings/m1') && method === 'POST') {
      mappingBody = body;
      return {
        id: 'm1',
        animalNo: '001',
        chipNo: body.chipNo,
        version: 2,
        active: true,
      };
    }
    if (path.endsWith('/purposes') && method === 'POST') {
      purposeBody = body;
      return { ...purpose, name: body.name };
    }
  });
  await page.getByRole('button', { name: '更正关系' }).click();
  await page.getByRole('dialog').getByLabel('芯片号').fill('0000456');
  await page.getByRole('dialog').getByLabel('更正原因').fill('更换芯片');
  await page.getByRole('dialog').getByRole('button', { name: '保存分组' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(mappingBody?.chipNo).toBe('0000456');
  expect(mappingBody?.reason).toBe('更换芯片');
  await navigateWorkspace(page, '用途配对');
  await page.getByRole('button', { name: '新增用途' }).click();
  await page.getByRole('dialog').getByLabel('用途名称').fill('安全性');
  await page.getByRole('dialog').getByLabel('采血管关键词（每行一个）').fill('全血\n血常规');
  await page.getByRole('dialog').getByRole('button', { name: '保存用途' }).click();
  await expect(page.getByText('请明确确认用途与配对规则', { exact: true })).toBeVisible();
  await page.getByLabel('我确认这组用途及允许配对规则').check();
  await page.getByRole('dialog').getByRole('button', { name: '保存用途' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(purposeBody?.collectionKeywords).toEqual(['全血', '血常规']);
  expect(purposeBody?.confirmed).toBe(true);
});
test.describe('实验标签300dpi渲染', () => {
  test.use({ deviceScaleFactor: 300 / 96 });
  test('完整标签黑白条形码与五字段导出300dpi图', async ({ page }, testInfo) => {
    await open(page, 'print', (path, _body, method) =>
      path.endsWith('/print-requests') && method === 'POST'
        ? {
            id: 'print1',
            status: 'REQUEST_ACKNOWLEDGED',
            tubes: [tube],
            createdAt: tube.createdAt,
          }
        : undefined,
    );
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
    await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
    await expect(page.getByText(/已登记打印请求/).first()).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    await page
      .locator('#experiment-print-root .experiment-print-page')
      .screenshot({ path: testInfo.outputPath('label-300dpi.png') });
    await expect(page.locator('#experiment-print-root .experiment-tube-label')).toHaveAttribute(
      'data-code',
      tube.code,
    );
    await expect(page.locator('#experiment-print-root .experiment-tube-label')).toHaveAttribute('data-barcode', tube.barcode);
    await page.pdf({ path: testInfo.outputPath('label-25x10mm.pdf'), preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
  });
});

test('扫码保存进行中刷新仍能重试原提交，不能遗失未确认操作', async ({ page }) => {
  const bodies: Body[] = [];
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await open(page, 'collection', async (path, body) => {
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')) return session;
    if (path.endsWith('/chip')) {
      bodies.push(body);
      if (bodies.length === 1) {
        await wait;
        return 'NETWORK';
      }
      return { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' };
    }
  });
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByLabel('扫描内容')).toBeDisabled();
  try {
    await page.reload();
    await expect(page.getByRole('button', { name: '重试原操作' })).toBeVisible();
    await expect(page.getByLabel('扫描内容')).toHaveValue('0000123');
    await page.getByRole('button', { name: '重试原操作' }).click();
    await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
    expect(bodies[0]).toEqual(bodies[1]);
  } finally {
    release();
  }
});
test('其他账号核对上下文独立，同一实验一个失败不污染另一个账号', async ({
  page,
  context: browserContext,
}) => {
  const other = await browserContext.newPage();
  await open(page, 'collection', (path) =>
    path.endsWith('/sessions/current') || path.endsWith('/sessions/s1')
      ? { ...session, state: 'FAILED', pending: 'COLLECTION_TUBE', animalNo: '001' }
      : undefined,
  );
  await open(other, 'collection', (path) =>
    path === '/api/auth/me'
      ? { id: 2, username: 'other', realName: '其他操作员', permissions: ['*'], roles: [] }
      : undefined,
  );
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  await expect(other.getByTestId('scan-state')).toContainText('尚未开始');
  await expect(other.getByRole('button', { name: '开始采血核对' })).toBeEnabled();
  await other.close();
});
test('会话已被另一页替代时读取当前会话，不显示旧通过或覆盖新条件', async ({ page }) => {
  let replaced = false;
  const latest = {
    ...session,
    id: 's2',
    state: 'FAILED',
    pending: 'CHIP',
    lastResult: { id: 'fail', round: 1, result: 'FAIL', message: '未知芯片' },
  };
  await open(page, 'collection', (path) => {
    if (path.endsWith('/sessions/current')) return replaced ? latest : session;
    if (path.endsWith('/sessions/s1')) return session;
    if (path.endsWith('/chip')) {
      replaced = true;
      return { httpStatus: 409 };
    }
  });
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('核对失败');
  await expect(page.getByText('未知芯片', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
});

test('后端返回按身份排序的打印快照时，打印仍保持预览勾选顺序', async ({ page }) => {
  await open(page, 'print', (path, _body, method) =>
    path.endsWith('/print-requests') && method === 'POST'
      ? {
          id: 'p2',
          status: 'REQUEST_ACKNOWLEDGED',
          createdAt: tube.createdAt,
          tubes: [tube, aliquot],
        }
      : undefined,
  );
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.getByRole('checkbox', { name: '选择标签 t2' }).check();
  await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
  await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
  await expect(page.getByText(/已登记打印请求/).first()).toBeVisible();
  await expect(
    page.locator('#experiment-print-root .experiment-tube-label').first(),
  ).toHaveAttribute('data-code', aliquot.code);
});
test('更正可明确清除用途来源和失效时间，避免隐藏旧条件继续生效', async ({ page }) => {
  let saved: Body | undefined;
  await open(page, 'aliquot-tubes', (path, body, method) => {
    if (path.endsWith('/tubes')) return [tube, { ...aliquot, expiresAt: '2026-11-01T00:00:00Z' }];
    if (path.endsWith('/tubes/t2') && method === 'POST') {
      saved = body;
      return {
        ...aliquot,
        id: 'new-unclassified',
        purposeId: '',
        sourceTubeId: '',
        confirmed: false,
        expiresAt: '',
      };
    }
  });
  await page.getByRole('button', { name: '更正 t2' }).click();
  await page.getByRole('dialog').getByLabel('确认用途', { exact: true }).selectOption('');
  await page.getByRole('dialog').getByLabel('可选失效时间').fill('');
  await page.getByRole('dialog').getByLabel('更正原因').fill('重新归类');
  await page.getByRole('dialog').getByRole('button', { name: '保存更正' }).click();
  await expect(page.getByText(/new-unclassified/).first()).toBeVisible();
  expect(saved?.purposeId).toBe('');
  expect(saved?.sourceTubeId).toBe('');
  expect(saved?.confirmed).toBe(false);
  expect(saved?.expiresAt).toBe('');
});

test('新入口默认进入实验列表，侧栏撤下旧版入口且系统管理仍可用', async ({ page }) => {
  await open(page, 'groups', (path) =>
    path === '/api/menus/routes'
      ? [
          {
            id: 1,
            parentId: 0,
            menuKey: 'experiments',
            routePath: '/experiments',
            menuName: '实验列表',
            component: 'ExperimentsPage',
            children: [],
          },
          {
            id: 2,
            parentId: 0,
            menuKey: 'dashboard',
            routePath: '/',
            menuName: '工作台',
            component: 'DashboardPage',
            children: [],
          },
          {
            id: 3,
            parentId: 0,
            menuKey: 'users',
            routePath: '/users',
            menuName: '用户管理',
            component: 'UserManagementPage',
            children: [],
          },
        ]
      : undefined,
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '实验列表', exact: true })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /工作台/ })).toHaveCount(0);
  await page.getByRole('button',{name:/系统管理/}).click();
  await page.getByRole('menuitem',{name:'用户管理',exact:true}).click();
  await expect(page.getByRole('heading',{name:'用户管理',exact:true})).toBeVisible();
  await page.goto('/legacy-workbench');
  await expect(page).toHaveURL(/\/legacy-workbench$/);
  await expect(page.getByRole('heading', { name: '扫码核对', exact: true })).toBeVisible();
  await page.getByRole('menuitem', { name: '用户管理' }).click();
  await expect(page.getByRole('heading', { name: '用户管理', exact: true })).toBeVisible();
});

test('真实timePoint不一致报错在扫码和历史详情中显示中文，未知消息保留', async ({ page }) => {
  const failedEvent = {
    id: 'real-error',
    projectId: 7,
    projectSnapshot: experiment,
    actorName: '测试员',
    createdAt: tube.createdAt,
    stage: 'COLLECTION',
    result: 'FAIL',
    message: 'timePoint不一致',
    actual: { ...tube, timePoint: '2h' },
  };
  await open(page, 'collection', (path) => {
    if (path.endsWith('/sessions/current') || path.endsWith('/sessions/s1'))
      return { ...session, state: 'FAILED', pending: 'COLLECTION_TUBE', lastResult: failedEvent };
    if (path.endsWith('/records'))
      return [failedEvent, { ...failedEvent, id: 'unknown-error', message: '设备返回ZX特殊状态' }];
    if (path.endsWith('/records/real-error')) return failedEvent;
  });
  await expect(page.getByText('时间点不一致', { exact: true })).toBeVisible();
  await navigateWorkspace(page, '核对记录');
  await expect(page.getByText('时间点不一致', { exact: true })).toBeVisible();
  await expect(page.getByText('设备返回ZX特殊状态', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '详情 real-error' }).click();
  await expect(page.getByRole('dialog').getByText('时间点不一致', { exact: true })).toBeVisible();
});
test('分组附件确认明确标识分组，提交不包含用途分配', async ({ page }) => {
  const groupBatch = {
    ...batch,
    kind: 'GROUP',
    fileName: '分组.xlsx',
    rows: [
      {
        rowKey: '分组:2',
        sourceSheet: '分组',
        sourceRow: 2,
        projectId: 7,
        projectCode: 'DEMO-001',
        animalNo: '001',
        chipNo: '0000123',
      },
    ],
  };
  let committed: Body | undefined;
  await open(page, 'imports', (path, body) => {
    if (path.endsWith('/imports/preview')) return groupBatch;
    if (path.endsWith('/commit')) {
      committed = body;
      return { ...groupBatch, status: 'COMMITTED', entityIds: ['m1'] };
    }
  });
  await page.getByLabel('附件类型').selectOption('GROUP');
  await upload(page);
  await expect(page.getByRole('button', { name: '确认分组并追加导入' })).toBeEnabled();
  await page.getByRole('button', { name: '确认分组并追加导入' }).click();
  await expect(page.getByText('已完整导入', { exact: true }).first()).toBeVisible();
  expect(committed?.confirmed).toBe(true);
  expect(committed?.assignments).toBeUndefined();
});

for (const action of [
  {
    tab: 'collection',
    key: 'scanner',
    path: '/api/experiments/sessions/s1/chip',
    body: { requestId: 'saved-scan', content: '0000123' },
  },
  {
    tab: 'print',
    key: '7:print',
    path: '/api/experiments/7/print-requests',
    body: { requestId: 'saved-print', tubeIds: ['t1'] },
  },
]) {
  test(`失去操作权限后${action.tab}页面不能重试以前保留的提交`, async ({ page }) => {
    await page.addInitScript(
      ({ key, path, body }) =>
        sessionStorage.setItem(`experiment-action:1:${key}`, JSON.stringify({ path, body })),
      action,
    );
    await open(
      page,
      action.tab,
      (path) =>
        path.endsWith('/sessions/current') || path.endsWith('/sessions/s1') ? session : undefined,
      ['project:view'],
    );
    await expect(page.getByRole('button', { name: '重试原操作' })).toBeDisabled();
  });
}

for (const replacement of [false, true]) {
  test(`缓存200 PASS重试必须读取当前${replacement ? '替代会话' : '更高轮'}FAILED`, async ({
    page,
  }) => {
    const initial = { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' };
    const cached = {
      ...initial,
      state: 'PASSED',
      pending: 'NONE',
      lastResult: { id: 'old-pass', round: 1, result: 'PASS', message: '旧轮一致', actual: tube },
    };
    const latest = {
      ...initial,
      id: replacement ? 's2' : 's1',
      round: replacement ? 1 : 2,
      state: 'FAILED',
      lastResult: {
        id: 'latest-fail',
        round: replacement ? 1 : 2,
        result: 'FAIL',
        message: '当前管不符',
        actual: aliquot,
      },
    };
    let current = initial as unknown;
    const bodies: Body[] = [];
    await open(
      page,
      'collection',
      (path, body) => {
        if (
          path.endsWith('/sessions/current') ||
          path.endsWith('/sessions/s1') ||
          path.endsWith('/sessions/s2')
        )
          return current;
        if (path.endsWith('/tube')) {
          bodies.push(body);
          current = latest;
          return bodies.length === 1 ? 'NETWORK' : cached;
        }
      },
      ['*'],
      false,
    );
    await page.getByLabel('扫描内容').fill(tube.code);
    await page.getByLabel('扫描内容').press('Enter');
    await expect(page.getByRole('button', { name: '重试原操作' })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('scan-state')).toHaveClass(/failed/);
    await page.getByRole('button', { name: '重试原操作' }).click();
    await expect(page.getByRole('button', { name: '重试原操作' })).toHaveCount(0);
    await expect(page.getByTestId('scan-state')).toContainText('核对失败');
    await expect(page.getByTestId('scan-state')).not.toHaveClass(/passed/);
    await expect(page.getByText('当前管不符', { exact: true })).toBeVisible();
    await expect(page.getByText('旧轮一致', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
    expect(bodies[1]).toEqual(bodies[0]);
  });
}

test('已保存扫码后当前读取失败保持原身份原码且关闭绿色通过，恢复重试安全', async ({ page }) => {
  const cached = {
    ...session,
    state: 'PASSED',
    pending: 'NONE',
    lastResult: { id: 'pass', round: 1, result: 'PASS', message: '核对一致', actual: tube },
  };
  let committed = false;
  let unavailable = true;
  const bodies: Body[] = [];
  await open(
    page,
    'collection',
    (path, body) => {
      if (path.endsWith('/sessions/current'))
        return committed
          ? unavailable
            ? 'NETWORK'
            : cached
          : { ...session, pending: 'COLLECTION_TUBE' };
      if (path.endsWith('/sessions/s1')) return { ...session, pending: 'COLLECTION_TUBE' };
      if (path.endsWith('/tube')) {
        bodies.push(body);
        committed = true;
        return cached;
      }
    },
    ['*'],
    false,
  );
  await page.getByLabel('扫描内容').fill(tube.code);
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByRole('button', { name: '重试原操作' })).toBeVisible();
  await expect(page.getByLabel('扫描内容')).toHaveValue(tube.code);
  await expect(page.getByTestId('scan-state')).not.toHaveClass(/passed/);
  await expect(page.getByText('核对一致', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下一轮' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '开始采血核对' })).toBeDisabled();
  unavailable = false;
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('核对通过');
  await expect(page.getByLabel('扫描内容')).toHaveValue('');
  expect(bodies[1]).toEqual(bodies[0]);
});

test('延迟打印POST切页后不自动打印，返回原身份显式恢复且不重复登记', async ({ page }) => {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const saved = {
    id: 'saved-print',
    status: 'REQUEST_ACKNOWLEDGED',
    tubes: [tube],
    createdAt: tube.createdAt,
  };
  let committed = false;
  let posts = 0;
  const bodies: Body[] = [];
  await open(page, 'print', async (path, body, method) => {
    if (!path.endsWith('/print-requests')) return undefined;
    if (method === 'GET') return committed ? [saved] : [];
    posts++;
    bodies.push(body);
    committed = true;
    await wait;
    return saved;
  });
  await page.evaluate(() => {
    (window as unknown as { printEvidence: number[] }).printEvidence = [];
    window.print = () => {
      (window as unknown as { printEvidence: number[] }).printEvidence.push(
        document.querySelectorAll('#experiment-print-root .experiment-print-page').length,
      );
    };
  });
  await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
  await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
  await expect.poll(() => posts).toBe(1);
  await navigateWorkspace(page,'采血管');
  const settled = page.waitForResponse((response) => response.request().method() === 'POST');
  release();
  await settled;
  // Flush the two animation frames that previously caused the unmounted print.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(
    await page.evaluate(() => (window as unknown as { printEvidence: number[] }).printEvidence),
  ).toEqual([]);
  expect(
    await page.evaluate(
      () => JSON.parse(sessionStorage.getItem('experiment-action:1:7:print') || 'null')?.body,
    ),
  ).toEqual(bodies[0]);
  await navigateWorkspace(page, '标签打印');
  await expect(page.getByRole('button', { name: '打开已登记请求 saved-print' })).toBeDisabled();
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { printEvidence: number[] }).printEvidence),
    )
    .toEqual([1]);
  expect(posts).toBe(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(new Set(bodies.map((body) => body.requestId)).size).toBe(1);
});

test('通过后重选条件隐藏旧绿色提示和实际管子', async ({ page }) => {
  const passed = {
    ...session,
    state: 'PASSED',
    pending: 'NONE',
    animalNo: '001',
    lastResult: { id: 'pass', round: 1, result: 'PASS', message: '核对一致', actual: tube },
  };
  await open(page, 'collection', (path) =>
    path.endsWith('/sessions/current') || path.endsWith('/sessions/s1') ? passed : undefined,
  );
  await expect(page.getByTestId('scan-state')).toHaveClass(/passed/);
  await page.getByRole('button', { name: '重新选择采样条件' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认重新选择' }).click();
  await expect(page.getByTestId('scan-state')).not.toHaveClass(/passed/);
  await expect(page.getByText('核对一致', { exact: true })).toHaveCount(0);
  await expect(page.getByText('实际扫描管子（本次保存快照）', { exact: true })).toHaveCount(0);
});

test('管子批量选择明确覆盖全部筛选结果', async ({ page }) => {
  const tubes = Array.from({ length: 21 }, (_, i) => ({ ...tube, id: `bulk-${i}`, barcode: String(i + 301).padStart(12, '0') }));
  await open(page, 'collection-tubes', (path) => (path.endsWith('/tubes') ? tubes : undefined));
  await page.getByRole('checkbox', { name: '选择筛选结果（最多1000支）', exact: true }).check();
  await expect(page.getByText('已选 21 支', { exact: false })).toBeVisible();
});

for (const source of [
  { ...tube, expiresAt: '2020-01-01T00:00:00Z', reason: '来源已过期' },
  { ...tube, confirmed: false, reason: '来源用途未确认' },
]) {
  test(`分装打印${source.reason}不可勾选并显示原因`, async ({ page }) => {
    await open(page, 'print', (path) => (path.endsWith('/tubes') ? [source, aliquot] : undefined));
    await expect(page.getByRole('checkbox', { name: '选择标签 t2' })).toBeDisabled();
    await expect(page.getByText(source.reason, { exact: true })).toBeVisible();
  });
}

for (const outcome of ['成功', '网络失败', '拒绝']) {
  test(`卸载旧请求迟到${outcome}不能清除或覆盖新待确认身份，刷新仍重试新请求`, async ({ page }) => {
    let releaseOld = () => {};
    const oldWait = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    const saved = {
      id: 'first-print',
      status: 'REQUEST_ACKNOWLEDGED',
      tubes: [tube],
      createdAt: tube.createdAt,
    };
    const bodies: Body[] = [];
    await open(page, 'print', async (path, body, method) => {
      if (!path.endsWith('/print-requests')) return undefined;
      if (method === 'GET') return bodies.length ? [saved] : [];
      bodies.push(body);
      if (bodies.length === 1) {
        await oldWait;
        return outcome === '成功'
          ? saved
          : outcome === '网络失败'
            ? 'NETWORK'
            : { httpStatus: 409 };
      }
      if (bodies.length === 2) return saved;
      return 'NETWORK';
    });
    await page.evaluate(() => {
      window.print = () => {};
    });
    await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
    await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
    await expect.poll(() => bodies.length).toBe(1);
    await navigateWorkspace(page,'采血管');
    await navigateWorkspace(page, '标签打印');
    await page.getByRole('button', { name: '重试原操作' }).click();
    await expect(page.getByRole('button', { name: '重试原操作' })).toHaveCount(0);
    await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
    await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
    await expect(page.getByRole('button', { name: '重试原操作' })).toBeVisible();
    expect(bodies).toHaveLength(3);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[2].requestId).not.toBe(bodies[0].requestId);
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(sessionStorage.getItem('experiment-action:1:7:print') || 'null'),
      );
    await expect.poll(async () => (await stored())?.body.requestId).toBe(bodies[2].requestId);
    const settled =
      outcome === '网络失败'
        ? page.waitForEvent('requestfailed', (request) => request.method() === 'POST')
        : page.waitForResponse((response) => response.request().method() === 'POST');
    releaseOld();
    await settled;
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect((await stored())?.body).toEqual(bodies[2]);
    await page.reload();
    await page.getByRole('button', { name: '重试原操作' }).click();
    await expect.poll(() => bodies.length).toBe(4);
    expect(bodies[3]).toEqual(bodies[2]);
  });
}

test('卸载扫码旧响应不再启动权威读取回调，原请求仍能安全重试', async ({ page }) => {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const bodies: Body[] = [];
  let currentGets = 0;
  let current: unknown = session;
  await open(
    page,
    'collection',
    async (path, body) => {
      if (path.endsWith('/sessions/current')) {
        currentGets++;
        return current;
      }
      if (path.endsWith('/sessions/s1')) return current;
      if (path.endsWith('/chip')) {
        bodies.push(body);
        if (bodies.length === 1) await wait;
        current = { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' };
        return current;
      }
    },
    ['*'],
    false,
  );
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect.poll(() => bodies.length).toBe(1);
  await navigateWorkspace(page,'采血管');
  const getsBeforeOldResponse = currentGets;
  const settled = page.waitForResponse((response) => response.request().method() === 'POST');
  release();
  await settled;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  expect(currentGets).toBe(getsBeforeOldResponse);
  await page.getByRole('navigation', { name: '实验内导航' }).getByRole('button', { name: '采血核对', exact: true }).click();
  await page.getByRole('button', { name: '重试原操作' }).click();
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  expect(bodies[1]).toEqual(bodies[0]);
});

test('持久化写入不可用时仍能在当前面板确认原请求', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('experiment-action:'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await open(page, 'collection', (path) =>
    path.endsWith('/chip')
      ? { ...session, pending: 'COLLECTION_TUBE', animalNo: '001' }
      : path.endsWith('/sessions/s1') || path.endsWith('/sessions/current')
        ? session
        : undefined,
  );
  await page.getByLabel('扫描内容').fill('0000123');
  await page.getByLabel('扫描内容').press('Enter');
  await expect(page.getByTestId('scan-state')).toContainText('扫描采血管');
  await expect(page.getByLabel('扫描内容')).toHaveValue('');
});

test('条形码可筛选当前管子，历史无别名的打印快照禁止猜码', async ({ page }) => {
  await open(page, 'print', (path, _body, method) =>
    path.endsWith('/print-requests') && method === 'POST'
      ? { id: 'oldprint', status: 'REQUEST_ACKNOWLEDGED', tubes: [{ ...tube, barcode: undefined }], createdAt: tube.createdAt }
      : undefined,
  );
  const search = page.getByPlaceholder('动物、时间点、管标、日期或短码');
  await search.fill(tube.barcode);
  await search.press('Enter');
  await expect(page.getByRole('checkbox', { name: '选择标签 t1' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '选择标签 t2' })).toHaveCount(0);
  await page.getByRole('checkbox', { name: '选择标签 t1' }).check();
  let prints = 0;
  await page.exposeFunction('testPrint', () => { prints += 1; });
  await page.evaluate(() => { window.print = () => { void (window as unknown as { testPrint(): void }).testPrint(); }; });
  await page.getByRole('button', { name: '登记打印请求并打开打印' }).click();
  await expect(page.getByText(/缺少有效的12位条形码/).last()).toBeVisible();
  expect(prints).toBe(0);
});


for (const tab of ['groups', 'collection-tubes', 'aliquot-tubes', 'imports', 'print', 'records']) {
  test(`每页数量可切换且真正显示50条：${tab}`, async ({ page }) => {
    const many = Array.from({ length: 65 }, (_, i) => ({ ...(tab === 'aliquot-tubes' ? aliquot : tube), id: `many-${i}`, animalNo: String(i) }));
    await open(page, tab, (path) => {
      if (path.endsWith('/tubes')) return tab === 'aliquot-tubes' ? [tube, ...many] : many;
      if (path.endsWith('/mappings')) return many.map((t) => ({ id:t.id, animalNo:t.animalNo, chipNo:`chip-${t.id}`, active:true, version:1 }));
      if (path.endsWith('/imports/preview')) return { ...batch, rows:many.map((t,i) => ({ ...batch.rows[0], rowKey:`Sheet1:${i+2}`,sourceRow:i+2,animalNo:t.animalNo })) };
      if (path.endsWith('/records')) return many.map((t) => ({ id:t.id, animalNo:t.animalNo, collectDate:t.collectDate, timePoint:t.timePoint, stage:'COLLECTION', result:'PASS', actorName:'测试员', createdAt:t.createdAt }));
    });
    if (tab === 'imports') await upload(page);
    const table = page.getByRole('table').first();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(20);
    await page.locator('.ant-pagination-options-size-changer').first().click();
    await page.getByRole('option', { name:'50 条/页', exact:true }).click();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(50);
    await page.getByRole('listitem', { name:'下一页', exact:true }).first().click();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(15);
    await page.locator('.ant-pagination-options-size-changer').first().click();
    await page.getByRole('option', { name:'500 条/页', exact:true }).click();
    await expect(table.locator('tbody tr.ant-table-row')).toHaveCount(65);
  });
}

test('管子全选按钮跨页只选筛选内有效管，改变条数保持已选并可清空', async ({ page }) => {
  const valid = Array.from({ length:45 }, (_,i) => ({ ...tube,id:`valid-${i}`,labelInfo:'筛选全血' }));
  await open(page, 'collection-tubes', (path) => path.endsWith('/tubes') ? [...valid,{ ...tube,id:'void-tube',status:'VOID',labelInfo:'筛选全血' },{ ...tube,id:'other-tube',labelInfo:'其他' }] : undefined);
  await page.getByRole('searchbox', { name:'查找管子' }).fill('筛选全血');
  await page.getByRole('searchbox', { name:'查找管子' }).press('Enter');
  await page.getByRole('button', { name:'全选筛选结果（最多1000支）', exact:true }).click();
  await expect(page.getByText('已选 45 支（最多1000）', { exact:true })).toBeVisible();
  await page.locator('.ant-pagination-options-size-changer').first().click();
  await page.getByRole('option', { name:'100 条/页', exact:true }).click();
  await expect(page.getByRole('checkbox', { name:/选择管子 valid-/ })).toHaveCount(45);
  await expect(page.getByRole('checkbox', { name:'选择管子 void-tube', exact:true })).not.toBeChecked();
  await page.getByRole('button', { name:'清空选择', exact:true }).click();
  await expect(page.getByText('已选 0 支（最多1000）', { exact:true })).toBeVisible();
});

test('标签全选按钮跨页排除不可打印管，并可清空', async ({ page }) => {
  const valid=Array.from({ length:25 }, (_,i) => ({ ...tube,id:`print-${i}` }));
  await open(page, 'print', (path) => path.endsWith('/tubes') ? [...valid,{ ...tube,id:'void-print',status:'VOID' },{ ...tube,id:'unconfirmed',confirmed:false }] : undefined);
  await page.getByRole('button', { name:'全选筛选结果（最多1000支）', exact:true }).click();
  await expect(page.getByRole('heading', { name:'已选 25 支 · 按勾选顺序逐页打印' })).toBeVisible();
  await expect(page.locator('.experiment-print-order li')).toHaveCount(25);
  await page.getByRole('button', { name:'清空选择', exact:true }).click();
  await expect(page.getByRole('heading', { name:'已选 0 支 · 按勾选顺序逐页打印' })).toBeVisible();
});

for (const tab of ['collection-tubes', 'aliquot-tubes', 'print']) {
  test(`输入动物号即刻查找跨页记录且清空恢复：${tab}`, async ({ page }) => {
    const many = Array.from({ length:45 }, (_,i) => ({ ...(tab==='aliquot-tubes'?aliquot:tube),id:`search-${i}`,animalNo:String(1000+i) }));
    await open(page, tab, (path) => path.endsWith('/tubes') ? tab==='aliquot-tubes'?[tube,...many]:many : undefined);
    const input=page.getByRole('searchbox', { name:tab==='print'?'查找打印管子':'查找管子',exact:true });
    await input.fill(' 1044 ');
    await expect(page.getByRole('table').first().locator('tbody tr.ant-table-row')).toHaveCount(1);
    await expect(page.getByRole('cell', { name:'1044',exact:true })).toBeVisible();
    await input.fill('nothing');
    await expect(page.getByRole('table').first().locator('tbody tr.ant-table-row')).toHaveCount(0);
    await input.fill('');
    await expect(page.getByRole('table').first().locator('tbody tr.ant-table-row')).toHaveCount(20);
  });
}

test('实验列表实时查找，进入实验后隐藏查找及切换，返回列表可重新选择', async ({ page }) => {
  const experiments=[experiment,{...experiment,id:8,projectCode:'STUDY-XYZ',projectName:'另一个实验'}];
  await open(page,'overview',(path)=>path==='/api/experiments'?experiments:undefined);
  await page.getByRole('button',{name:'返回实验列表',exact:true}).click();
  await page.getByRole('searchbox',{name:'查找实验',exact:true}).fill(' study-xy ');
  await expect(page.getByRole('table').locator('tbody tr.ant-table-row')).toHaveCount(1);
  await expect(page.getByRole('cell',{name:'STUDY-XYZ',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'进入实验',exact:true}).click();
  await expect(page.getByRole('heading',{name:'STUDY-XYZ · 另一个实验',exact:true})).toBeVisible();
  await expect(page.getByRole('searchbox',{name:'查找实验',exact:true})).toHaveCount(0);
  await expect(page.getByLabel('选择实验',{exact:true})).toHaveCount(0);
  await expect(page.getByText(/匹配.*个实验/)).toHaveCount(0);
  await page.getByRole('button',{name:'返回实验列表',exact:true}).click();
  await expect(page.getByRole('searchbox',{name:'查找实验',exact:true})).toHaveValue(' study-xy ');
  await page.getByRole('searchbox',{name:'查找实验',exact:true}).fill('demo');
  await page.getByLabel('选择实验',{exact:true}).selectOption('7');
  await expect(page.getByRole('heading',{name:'DEMO-001 · 实验演示',exact:true})).toBeVisible();
});

for(const stage of ['collection','aliquot']) {
  test(`时间点按原列完整展示日期分布，切换日期重置条件：${stage}`,async({page})=>{
    const model=stage==='collection'?tube:aliquot;
    const rows=[{...model,id:'date1',collectDate:'2026-10-05',timePoint:'分组后'},...['D1-0.5hr','D1-1hr','D1-2hr'].map((timePoint,i)=>({...model,id:`date2-${i}`,collectDate:'2026-10-06',timePoint}))];
    await open(page,stage,(path)=>path.endsWith('/tubes')?rows:undefined);
    await page.getByText('操作说明与采样日期／时间点',{exact:true}).click();
    await expect(page.getByText('2026-10-06：D1-0.5hr、D1-1hr、D1-2hr',{exact:true})).toBeVisible();
    await page.getByLabel('采样日期',{exact:true}).selectOption('2026-10-05');
    await expect(page.getByLabel('时间点',{exact:true}).locator('option')).toHaveCount(5);
    await expect(page.getByLabel('时间点',{exact:true}).locator('option[value="D1-1hr"]')).toHaveAttribute('disabled', '');
    await page.getByRole('button',{name:'选择日期 2026-10-06',exact:true}).click();
    await page.getByLabel('时间点',{exact:true}).selectOption('D1-1hr');
    await page.getByLabel('本次用途',{exact:true}).selectOption('p1');
    await page.getByRole('button',{name:'选择日期 2026-10-05',exact:true}).click();
    await expect(page.getByLabel('时间点',{exact:true})).toHaveValue('');
    await expect(page.getByLabel('本次用途',{exact:true})).toHaveValue('');
  });
}

test('仅ADMIN角色可见删除及已删除实验入口，通配权限不替代管理员', async ({ page }) => {
  await open(page, 'overview');
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除实验', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '已删除实验', exact: true })).toHaveCount(0);
});

test('管理员确认删除带原因，取消不提交，网络重试保持原身份并可恢复', async ({ page }) => {
  let removed = false;
  const bodies: Body[] = [];
  await open(page, 'overview', (path, body, method, query) => {
    if (path === '/api/auth/me') return { id: 1, username: 'admin-test', realName: '测试管理员', roles: ['ADMIN'], permissions: ['*'] };
    if (path === '/api/experiments') return query.get('deleted') === 'true'
      ? removed ? [{ ...experiment, status: 'DELETED' }] : [] : removed ? [] : [experiment];
    if (path.endsWith('/delete') && method === 'POST') {
      bodies.push(body); removed = true;
      if (bodies.length === 1) return 'NETWORK';
      return { ...experiment, status: 'DELETED' };
    }
    if (path.endsWith('/restore') && method === 'POST') {
      bodies.push(body); removed = false; return experiment;
    }
  });
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByRole('button', { name: '删除实验', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除实验', exact: true });
  await expect(dialog.getByText(/DEMO-001/)).toBeVisible();
  await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
  expect(bodies).toHaveLength(0);
  await page.getByRole('button', { name: '删除实验', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '确认删除', exact: true })).toBeDisabled();
  await dialog.getByLabel('操作原因', { exact: true }).fill('误建测试实验');
  await dialog.getByRole('checkbox', { name: /我确认删除/ }).check();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '重试原操作', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: '重试原操作', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入实验', exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  expect(bodies[0].reason).toBe('误建测试实验');
  await page.getByRole('button', { name: '已删除实验', exact: true }).click();
  await page.getByRole('button', { name: '核对记录', exact: true }).click();
  await expect(page.getByText('实验已删除，仅可查看追溯记录；需管理员恢复后才能继续操作。')).toBeVisible();
  await expect(page.getByRole('button', { name: '采血核对', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '标签打印', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByRole('button', { name: '恢复实验', exact: true }).click();
  const restore = page.getByRole('dialog', { name: '恢复实验', exact: true });
  await restore.getByLabel('操作原因', { exact: true }).fill('恢复测试');
  await restore.getByRole('checkbox', { name: /我确认恢复/ }).check();
  await restore.getByRole('button', { name: '确认恢复', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复实验', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '正常实验', exact: true }).click();
  await expect(page.getByRole('button', { name: '进入实验', exact: true })).toBeVisible();
  expect(bodies).toHaveLength(3);
});

test('服务器拒绝活动实验删除时保留列表并显示原因', async ({ page }) => {
  await open(page, 'overview', (path) => {
    if (path === '/api/auth/me') return { id: 1, roles: ['ADMIN'], permissions: ['*'] };
    if (path.endsWith('/delete')) return { httpStatus: 409 };
  });
  await page.getByRole('button', { name: '返回实验列表', exact: true }).click();
  await page.getByRole('button', { name: '删除实验', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '删除实验', exact: true });
  await dialog.getByLabel('操作原因', { exact: true }).fill('删除测试');
  await dialog.getByRole('checkbox', { name: /我确认删除/ }).check();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog.getByText('重复内容，请明确确认追加', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入实验', exact: true })).toBeVisible();
});

const importedAliquots = Array.from({ length: 320 }, (_, i) => ({
  ...aliquot, id: `imported-aliquot-${i}`, labelInfo: `血浆-${i + 1}`,
  barcode: String(1000 + i).padStart(12, '0'),
}));

test('后台已导入但页面未获确认时，切换分装与打印重读320支资料', async ({ page }) => {
  let committed = false;
  let writes = 0;
  await open(page, 'imports', (path, _body, method) => {
    if (method === 'POST') writes++;
    if (path.endsWith('/tubes')) return committed ? [tube, ...importedAliquots] : [tube];
  });
  committed = true;
  const nav = page.getByRole('navigation', { name: '实验内导航' });
  await navigateWorkspace(page,'分装管');
  await expect(page.getByText('共 320 条，当前 1–20 条', { exact: true })).toBeVisible();
  await navigateWorkspace(page,'标签打印');
  await page.getByLabel('打印管子类型', { exact: true }).selectOption('ALIQUOT');
  await expect(page.getByText('共 320 条，当前 1–20 条', { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '选择标签 imported-aliquot-0', exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test('提交分装期间离开附件页，响应确认后更新当前列表并原编号重试', async ({ page }) => {
  let committed = false;
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { entered = resolve; });
  const bodies: Body[] = [];
  const preview = { ...batch, kind: 'ALIQUOT', fileName: '分装.xlsx' };
  const saved = { ...preview, status: 'COMMITTED', entityIds: importedAliquots.map((t) => t.id) };
  await open(page, 'imports', async (path, body) => {
    if (path.endsWith('/tubes')) return committed ? [tube, ...importedAliquots] : [tube];
    if (path.endsWith('/imports/preview')) return preview;
    if (path.endsWith('/imports')) return committed ? [saved] : [];
    if (path.endsWith('/commit')) {
      bodies.push(body);
      if (bodies.length === 1) {
        entered();
        await gate;
        committed = true;
      }
      return saved;
    }
  });
  await upload(page);
  await page.getByRole('button', { name: '确认用途并追加导入', exact: true }).click();
  await started;
  const nav = page.getByRole('navigation', { name: '实验内导航' });
  await navigateWorkspace(page,'分装管');
  await expect(page.getByRole('heading', { name: '分装管列表', exact: true })).toBeVisible();
  release();
  await expect(page.getByText('共 320 条，当前 1–20 条', { exact: true })).toBeVisible();
  await navigateWorkspace(page,'附件导入');
  await page.getByRole('button', { name: '重试原操作', exact: true }).click();
  await expect(page.getByRole('button', { name: '重试原操作', exact: true })).toHaveCount(0);
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toEqual(bodies[1]);
  await navigateWorkspace(page,'标签打印');
  await page.getByLabel('打印管子类型', { exact: true }).selectOption('ALIQUOT');
  await expect(page.getByText('共 320 条，当前 1–20 条', { exact: true })).toBeVisible();
});

for (const tab of ['groups', 'collection-tubes', 'aliquot-tubes', 'print']) {
  test(`原表顺序经过分页和筛选仍保持：${tab}`, async ({ page }) => {
    const fileOrder = Array.from({ length: 25 }, (_, i) => ({
      ...(tab === 'aliquot-tubes' ? aliquot : tube),
      id: `source-${25-i}`,
      animalNo: String(((i * 7) % 25) + 1).padStart(3, '0'),
      barcode: String(1000 + i).padStart(12, '0'),
    }));
    for (const row of fileOrder) row.labelInfo = row.animalNo.includes('01') ? '筛选目标' : '其他样品';
    await open(page, tab, (path) => {
      if (path.endsWith('/tubes')) return tab === 'aliquot-tubes' ? [tube, ...fileOrder] : fileOrder;
      if (path.endsWith('/mappings')) return fileOrder.map(t => ({ id:t.id,animalNo:t.animalNo,chipNo:`chip-${t.id}`,active:true,version:1 }));
    });
    const table = page.getByRole('table').first();
    const rows = table.locator('tbody tr.ant-table-row');
    for (let i = 0; i < 20; i++) await expect(rows.nth(i).getByRole('cell', { name:fileOrder[i].animalNo,exact:true })).toBeVisible();
    await page.getByRole('listitem', { name:'下一页',exact:true }).first().click();
    for (let i = 20; i < 25; i++) await expect(rows.nth(i-20).getByRole('cell', { name:fileOrder[i].animalNo,exact:true })).toBeVisible();
    if (tab !== 'groups') {
      await page.getByRole('searchbox', { name:tab==='print'?'查找打印管子':'查找管子',exact:true }).fill('筛选目标');
      const matches = fileOrder.filter(t => t.animalNo.includes('01'));
      await expect(rows).toHaveCount(matches.length);
      for (let i = 0; i < matches.length; i++) await expect(rows.nth(i).getByRole('cell', { name:matches[i].animalNo,exact:true })).toBeVisible();
    }
  });
}

test('全选标签的预览、提交和实体打印顺序与原表一致', async ({ page }) => {
  const fileOrder = ['900','100','700','200'].map((animalNo,i) => ({
    ...tube, id:`source-${4-i}`,animalNo,barcode:String(1000+i).padStart(12,'0'),
  }));
  let submitted: unknown;
  await open(page, 'print', (path, body, method) => {
    if (path.endsWith('/tubes')) return fileOrder;
    if (path.endsWith('/print-requests') && method === 'POST') {
      submitted = body.tubeIds;
      return { id:'ordered-print',status:'REQUEST_ACKNOWLEDGED',tubes:fileOrder,createdAt:tube.createdAt };
    }
  });
  await page.evaluate(() => { window.print = () => {}; });
  await page.getByRole('button', { name:'全选筛选结果（最多1000支）',exact:true }).click();
  const selected = page.locator('.experiment-print-order li');
  await expect(selected).toHaveCount(4);
  for (let i=0;i<4;i++) await expect(selected.nth(i)).toContainText(fileOrder[i].animalNo);
  await page.getByRole('button', { name:'登记打印请求并打开打印' }).click();
  await expect(page.getByText(/已登记打印请求/).first()).toBeVisible();
  expect(submitted).toEqual(fileOrder.map(t => t.id));
  await expect(page.locator('#experiment-print-root .experiment-tube-label')).toHaveCount(4);
  for (let i=0;i<4;i++) await expect(page.locator('#experiment-print-root .experiment-tube-label').nth(i)).toHaveAttribute('data-barcode',fileOrder[i].barcode);
});

for (const stage of ['collection','aliquot']) {
  test(`扫码条件默认按原表首次出现顺序排列：${stage}`, async ({ page }) => {
    const model = stage === 'collection' ? tube : aliquot;
    const rows = [
      { ...model,id:'order-a',collectDate:'2026-10-07',timePoint:'6h' },
      { ...model,id:'order-b',collectDate:'2026-10-05',timePoint:'1h' },
      { ...model,id:'order-c',collectDate:'2026-10-07',timePoint:'4h' },
      { ...model,id:'order-d',collectDate:'2026-10-06',timePoint:'2h' },
    ];
    await open(page,stage,(path) => path.endsWith('/tubes') ? rows : undefined);
    await expect(page.getByLabel('采样日期',{exact:true}).locator('option')).toHaveText(['请选择','2026-10-07','2026-10-05','2026-10-06']);
    await expect(page.getByLabel('时间点',{exact:true}).locator('option')).toHaveText(['请选择','6h','1h','4h','2h']);
  });
}

test('条码下所有文字居中且位于单张标签边界内', async ({ page }) => {
  await open(page,'print');
  await page.getByRole('checkbox',{name:'选择标签 t1',exact:true}).check();
  const geometry = await page.locator('.experiment-label-artwork').first().evaluate(svg => {
    const width = (svg as SVGSVGElement).viewBox.baseVal.width;
    return Array.from(svg.querySelectorAll('text')).map(text => {
      const box = text.getBBox();
      return {center:box.x+box.width/2,expected:width/2,left:box.x,right:box.x+box.width,width};
    });
  });
  expect(geometry).toHaveLength(4);
  for (const line of geometry) {
    expect(line.center).toBeCloseTo(line.expected,0);
    expect(line.left).toBeGreaterThanOrEqual(3);
    expect(line.right).toBeLessThanOrEqual(line.width-3);
  }
});

for (const tab of ['collection-tubes','aliquot-tubes']) {
  test(`管子表格完整显示且桌面不需要横向拖动：${tab}`, async ({ page }) => {
    await page.setViewportSize({width:1280,height:900});
    const row = {...(tab==='aliquot-tubes'?aliquot:tube),id:'width-check',animalNo:'3102',labelInfo:'T-00-P-a 完整原样样品信息'};
    await open(page,tab,(path) => path.endsWith('/tubes') ? [tube,row] : undefined);
    const dimensions = await page.locator('table').first().evaluate(table => ({width:table.getBoundingClientRect().width,available:table.parentElement!.clientWidth,scroll:table.parentElement!.scrollWidth}));
    expect(dimensions.width).toBeLessThanOrEqual(dimensions.available+1);
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.available+1);
    await expect(page.getByRole('cell',{name:row.labelInfo,exact:true})).toBeVisible();
    await page.setViewportSize({width:375,height:812});
    const narrow = await page.getByRole('searchbox',{name:'查找管子'}).evaluate(input => ({right:input.closest('.ant-input-search')!.getBoundingClientRect().right,available:document.documentElement.clientWidth}));
    expect(narrow.right).toBeLessThanOrEqual(narrow.available);
    await expect(page.getByText(row.labelInfo,{exact:true})).toBeVisible();
  });
}

test('实验页面撤掉外层侧栏，扫码框位于页面中上部',async({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await open(page,'collection',(path) => path.endsWith('/sessions/current') || path.endsWith('/sessions/s1') ? session : undefined);
  await expect(page.locator('.app-sider')).toHaveCount(0);
  await expect(page.getByLabel('扫描内容',{exact:true})).toBeEnabled();
  const scan = await page.getByLabel('扫描内容',{exact:true}).boundingBox();
  expect(scan!.y).toBeLessThan(520);
  expect(Math.abs(scan!.x+scan!.width/2-720)).toBeLessThan(10);
  await expect(page.getByLabel('扫描内容',{exact:true})).toBeEnabled();
});
