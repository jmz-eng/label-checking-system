import { test, expect, type Page } from '@playwright/test';

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
async function open(page: Page, tab = 'groups', handler?: Handler, permissions = ['*']) {
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
    await route.fulfill({ json: { code: 200, data } });
  });
  await page.addInitScript(() => localStorage.setItem('tag-management-token', 'test-token'));
  await page.goto(`/experiments?experiment=7&tab=${tab}`);
  await expect(page.getByRole('heading', { name: 'DEMO-001 · 实验演示' })).toBeVisible();
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

test('实验选择和当前工作页在刷新后保留，窄屏仍能打开导航', async ({ page }) => {
  await open(page);
  await page.getByRole('tab', { name: '采血管' }).click();
  await page.reload();
  await expect(page.getByRole('tab', { name: '采血管' })).toHaveAttribute('aria-selected', 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开导航' }).click();
  await expect(page.getByRole('dialog').getByText('实验列表')).toBeVisible();
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
test('用途归类与歧义配对批量确认，保存响应后刷新新管身份', async ({ page }) => {
  let assignment: Body | undefined;
  await open(page, 'aliquot-tubes', (path, body) => {
    if (path.endsWith('/tube-assignments')) {
      assignment = body;
      return {
        tubes: [{ ...aliquot, id: 'replacement', code: 'E1234567890123456789012' }],
      };
    }
    if (path.endsWith('/tubes'))
      return [
        tube,
        { ...tube, id: 't3', code: 'E1234567890123456789013' },
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
        code: 'E1234567890123456789012',
        replacesId: 't1',
      };
    }
  });
  await page.getByRole('button', { name: '更正 t1' }).click();
  await expect(page.getByRole('dialog')).toContainText('旧二维码将作废');
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
            code: 'E1234567890123456789012',
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
test('批量打印每支独立25x10mm页，只登记请求，补打保持二维码', async ({ page }) => {
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
  await page.getByRole('tab', { name: '附件导入' }).click();
  await expect(page.getByText('当前账号没有附件导入权限', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '采血管' }).click();
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
  await page.getByRole('tab', { name: '用途配对' }).click();
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
  test('完整标签黑白二维码与五字段导出300dpi图', async ({ page }, testInfo) => {
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

test('新入口默认进入实验列表，旧版工作台与系统管理仍分别可用', async ({ page }) => {
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
  await page.getByRole('menuitem', { name: '工作台（旧版）' }).click();
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
  await page.getByRole('tab', { name: '核对记录' }).click();
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
