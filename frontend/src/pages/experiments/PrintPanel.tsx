import { Alert, Button, Checkbox, Input, Pagination, Space, Table, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { experimentPath } from '../../api/experiments';
import { http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import type { PrintRequest, Purpose, Tube } from '../../types/experiments';
import { createTubeLabelLayout } from '../../utils/tubeLabelLayout';
import {
  CommandFeedback,
  errorText,
  NativeSelect,
  SectionTitle,
  shanghaiTime,
  useCommand,
} from './shared';
import { TubeLabel } from './TubeLabel';
export function PrintPanel({
  projectId,
  tubes,
  purposes,
  refresh,
}: {
  projectId: number;
  tubes: Tube[];
  purposes: Purpose[];
  refresh: () => Promise<void>;
}) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('label:view');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState<PrintRequest[]>([]);
  const [printTubes, setPrintTubes] = useState<Tube[]>([]);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  const printing = useRef(false);
  const [openingPrint, setOpeningPrint] = useState(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let active = true;
    if (allowed)
      void http
        .get<PrintRequest[]>(`${experimentPath(projectId)}/print-requests`)
        .then((data) => {
          if (active) setHistory(data);
        })
        .catch((e) => {
          if (active) setError(errorText(e));
        });
    return () => {
      active = false;
    };
  }, [projectId, allowed]);
  async function openSavedRequest(response: PrintRequest, requestedIds?: string[]) {
    if (!mounted.current || printing.current) return;
    if (response.status !== 'REQUEST_ACKNOWLEDGED') {
      setError('服务器未确认打印请求，请重新读取记录。');
      return;
    }
    setNotice(
      `已登记打印请求 ${response.id}，共 ${response.tubes.length} 支。请在打印窗口确认设备与纸张；取消窗口也不代表实际打印完成。`,
    );
    const invalid = response.tubes.filter((t) => createTubeLabelLayout(t).error);
    if (invalid.length) {
      setError('服务器返回的标签包含过长内容，请重新预览。已登记请求，但未打开打印。');
      return;
    }
    const ids = requestedIds?.length ? requestedIds : response.tubes.map((tube) => tube.id);
    const ordered = ids
      .map((id) => response.tubes.find((tube) => tube.id === id))
      .filter((tube): tube is Tube => !!tube);
    if (ordered.length !== ids.length) {
      setError('打印请求已登记，但标签清单不完整，请读取请求记录后重新预览。');
      return;
    }
    printing.current = true;
    setOpeningPrint(true);
    setError('');
    try {
      setPrintTubes(ordered);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      // Leaving this panel cancels the intent, even after the POST was committed.
      if (
        mounted.current &&
        document.querySelector('#experiment-print-root .experiment-print-page')
      )
        window.print();
    } finally {
      printing.current = false;
      if (mounted.current) setOpeningPrint(false);
    }
  }
  const command = useCommand<PrintRequest>(
    async (response, _path, body) => {
      if (!mounted.current) return;
      await openSavedRequest(response, body.tubeIds as string[] | undefined);
      if (!mounted.current) return;
      await refresh();
      const requests = await http.get<PrintRequest[]>(
        `${experimentPath(projectId)}/print-requests`,
      );
      if (mounted.current) setHistory(requests);
    },
    undefined,
    `${projectId}:print`,
  );
  const selectedTubes = selected
    .map((id) => tubes.find((t) => t.id === id))
    .filter((t): t is Tube => !!t);
  const overflows = selectedTubes.flatMap((t) => {
    const error = createTubeLabelLayout(t).error;
    return error ? [{ tube: t, error }] : [];
  });
  function basicIneligible(t: Tube): string {
    if (t.status !== 'ACTIVE') return '已作废';
    if (!t.confirmed || !t.purposeId) return '用途未确认';
    if (!purposes.some((p) => p.id === t.purposeId && p.active && p.confirmed)) return '用途已停用';
    if (t.expiresAt && new Date(t.expiresAt).getTime() <= now) return '已过期';
    return '';
  }
  function ineligible(t: Tube): string {
    const reason = basicIneligible(t);
    if (reason) return reason;
    if (t.kind === 'ALIQUOT') {
      const source = tubes.find((s) => s.id === t.sourceTubeId && s.kind === 'COLLECTION');
      if (!source) return '来源待确认或已失效';
      const sourceReason = basicIneligible(source);
      if (sourceReason) return `来源${sourceReason}`;
    }
    return '';
  }
  const invalid = selectedTubes.filter((t) => ineligible(t));
  const missing = selected.filter((id) => !tubes.some((t) => t.id === id));
  const busy = command.busy || !!command.pending || openingPrint || !allowed;
  const rows = tubes.filter(
    (t) =>
      (!kind || t.kind === kind) &&
      `${t.animalNo} ${t.timePoint} ${t.labelInfo} ${t.collectDate} ${t.code}`.includes(search),
  );
  function select(ids: string[]) {
    setSelected(ids);
    setPrintTubes([]);
    setPage(1);
    setNotice('');
  }
  const preview = selectedTubes.slice((page - 1) * 12, page * 12);
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <SectionTitle title="完整标签预览与批量打印" />
      <Alert
        type="info"
        message="25 × 10 mm；左侧黑白二维码，右侧完整五项原始字段。300 dpi 使用整数码元和四格白色留边。最小字号 16 打印点（约3.84磅），需用实际纸张、打印机和扫码设备确认可读性。过长标签逐支提示，不能裁切或无限缩小。"
      />
      {!allowed && <Alert type="warning" message="当前账号没有标签打印权限" />}
      <Space wrap>
        <NativeSelect
          label="打印管子类型"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'COLLECTION', label: '采血管' },
            { value: 'ALIQUOT', label: '分装管' },
          ]}
          placeholder="全部管子"
        />
        <Input.Search
          placeholder="动物、时间点、管标、日期或短码"
          onSearch={setSearch}
          style={{ width: 320 }}
        />
        <Button
          disabled={busy}
          onClick={() =>
            select(
              rows
                .filter((t) => !ineligible(t))
                .slice(0, 1000)
                .map((t) => t.id),
            )
          }
        >
          选择筛选结果（最多1000支）
        </Button>
        <Button disabled={busy} onClick={() => select([])}>
          清空选择
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 950 }}
        columns={[
          {
            title: '选择',
            render: (_, t) => (
              <Checkbox
                aria-label={`选择标签 ${t.id}`}
                disabled={busy || !!ineligible(t)}
                checked={selected.includes(t.id)}
                onChange={(e) =>
                  select(
                    e.target.checked ? [...selected, t.id] : selected.filter((id) => id !== t.id),
                  )
                }
              />
            ),
          },
          { title: '动物号', dataIndex: 'animalNo' },
          { title: '采样日期', dataIndex: 'collectDate' },
          { title: '时间点', dataIndex: 'timePoint' },
          {
            title: '管标信息',
            dataIndex: 'labelInfo',
            render: (v: string) => <span className="preserve-text">{v}</span>,
          },
          {
            title: '用途',
            render: (_, t) => purposes.find((p) => p.id === t.purposeId)?.name || '待确认',
          },
          {
            title: '打印 / 可用状态',
            render: (_, t) =>
              ineligible(t) || (t.printed ? '同一支管补打，二维码不变' : '首次打印请求'),
          },
        ]}
      />
      <Typography.Title level={4}>
        已选 {selectedTubes.length} 支 · 按勾选顺序逐页打印
      </Typography.Title>
      <ol className="experiment-print-order">
        {selectedTubes.map((t) => (
          <li key={t.id}>
            {t.animalNo} · {t.collectDate} · {t.timePoint} ·{' '}
            {purposes.find((p) => p.id === t.purposeId)?.name} · {t.id}
          </li>
        ))}
      </ol>
      {!!overflows.length && (
        <Alert
          data-testid="label-overflows"
          type="error"
          message="以下标签无法完整清晰排入25 × 10 mm，禁止打印此批次"
          description={
            <ul>
              {overflows.map((item) => (
                <li key={item.tube.id}>
                  {item.tube.id} · {item.tube.animalNo}：{item.error}
                </li>
              ))}
            </ul>
          }
        />
      )}
      {!!missing.length && (
        <Alert type="error" message="所选管子资料已更正，请清空选择后重新勾选新身份。" />
      )}
      {!!invalid.length && (
        <Alert
          type="error"
          message={`所选管子已不可用：${invalid.map((t) => `${t.id}（${ineligible(t)}）`).join('；')}。请刷新选择。`}
        />
      )}
      <div className="experiment-label-grid">
        {preview.map((t) => (
          <div className="experiment-label-card" key={t.id}>
            <span>
              {selected.indexOf(t.id) + 1} / {selectedTubes.length} · {t.animalNo}
            </span>
            <TubeLabel tube={t} />
            <dl>
              {[
                ['试验编号', t.projectCode],
                ['动物号', t.animalNo],
                ['时间点', t.timePoint],
                ['管标信息', t.labelInfo],
                ['采样日期', t.collectDate],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd className="preserve-text">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {selectedTubes.length > 12 && (
        <Pagination
          current={page}
          pageSize={12}
          total={selectedTubes.length}
          showSizeChanger={false}
          onChange={setPage}
        />
      )}
      <Button
        type="primary"
        disabled={
          busy ||
          !selectedTubes.length ||
          selectedTubes.length > 1000 ||
          !!overflows.length ||
          !!invalid.length ||
          !!missing.length
        }
        loading={command.busy}
        onClick={() =>
          void command.execute(`${experimentPath(projectId)}/print-requests`, {
            tubeIds: selected,
          })
        }
      >
        登记打印请求并打开打印
      </Button>
      <CommandFeedback command={command} allowed={allowed} />
      {notice && <Alert type="success" message={notice} />}{' '}
      {error && <Alert type="error" message={error} />}
      <Typography.Title level={4}>打印请求历史（含同管补打）</Typography.Title>
      <Table
        rowKey="id"
        dataSource={history}
        columns={[
          { title: '请求编号', dataIndex: 'id' },
          {
            title: '时间（上海）',
            render: (_, p) => shanghaiTime(p.createdAt),
          },
          { title: '操作账号', dataIndex: 'actorId' },
          { title: '管数', render: (_, p) => p.tubes.length },
          { title: '状态', render: () => '已登记请求（实体打印结果未确认）' },
          {
            title: '恢复打印窗口',
            render: (_, request) => (
              <Button disabled={busy} onClick={() => void openSavedRequest(request)}>
                打开已登记请求 {request.id}
              </Button>
            ),
          },
        ]}
      />
      {!!printTubes.length &&
        createPortal(
          <div id="experiment-print-root">
            {printTubes.map((t) => (
              <div key={t.id} className="experiment-print-page">
                <TubeLabel tube={t} />
              </div>
            ))}
          </div>,
          document.body,
        )}
    </Space>
  );
}
