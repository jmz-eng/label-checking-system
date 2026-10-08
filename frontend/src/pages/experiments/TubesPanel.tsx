import { experimentPagination, searchText } from './shared';
import { Alert, Button, Checkbox, Collapse, Form, Input, Modal, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { experimentPath } from '../../api/experiments';
import { http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import type { ExperimentEvent, Kind, Purpose, Tube, TubeInput } from '../../types/experiments';
import { EventDetails, Snapshot } from './EventDetails';
import {
  CommandFeedback,
  errorText,
  JsonDetail,
  NativeSelect,
  purposeOptions,
  SectionTitle,
  shanghaiTime,
  TubeFields,
  useCommand,
} from './shared';
export function TubesPanel({
  projectId,
  kind,
  tubes,
  purposes,
  refresh,
}: {
  projectId: number;
  kind: Kind;
  tubes: Tube[];
  purposes: Purpose[];
  refresh: () => Promise<void>;
}) {
  const { hasPermission } = useAuth();
  const name = kind === 'COLLECTION' ? '采血管' : '分装管';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [purposeId, setPurposeId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [reason, setReason] = useState('');
  const [editing, setEditing] = useState<Tube | 'new' | null>(null);
  const [mode, setMode] = useState<'edit' | 'reissue'>('edit');
  const [voiding, setVoiding] = useState<Tube | null>(null);
  const [detail, setDetail] = useState<Tube | null>(null);
  const [events, setEvents] = useState<ExperimentEvent[] | null>(null);
  const [validation, setValidation] = useState('');
  const [saved, setSaved] = useState('');
  const [form] = Form.useForm<TubeInput & { reason?: string }>();
  const watchedPurpose = Form.useWatch('purposeId', form) as string | undefined;
  const watchedAnimal = Form.useWatch('animalNo', form) as string | undefined;
  const watchedDate = Form.useWatch('collectDate', form) as string | undefined;
  const watchedTime = Form.useWatch('timePoint', form) as string | undefined;
  const command = useCommand<Tube | { tubes: Tube[] }>(
    async (result, path) => {
      setValidation('');
      setEditing(null);
      setVoiding(null);
      setSelected([]);
      if ('tubes' in result)
        setSaved(
          `批量更正已保存：${result.tubes.map((t) => `${t.id} · 条形码 ${t.barcode ?? "未登记"}`).join('；')}。旧码已作废，请打印替换标签。`,
        );
      else
        setSaved(
          path.endsWith('/void')
            ? `管子 ${result.id} 已作废，旧码不能继续使用。`
            : `已保存新管子身份 ${result.id} · 条形码 ${result.barcode ?? "未登记"}${result.replacesId ? '；旧标签码已作废，请打印新标签并替换。' : ''}`,
        );
      await refresh();
    },
    undefined,
    `${projectId}:tubes:${kind}`,
  );
  const blocked = command.busy || !!command.pending || !hasPermission('sample:generate');
  const rows = tubes.filter(
    (t) =>
      t.kind === kind &&
      (!status || t.status === status) &&
      searchText(`${t.projectCode} ${t.animalNo} ${t.timePoint} ${t.labelInfo} ${t.collectDate} ${t.barcode ?? ""} ${t.code} ${t.id}`).includes(searchText(search)),
  );
  const selectable = rows.filter((t) => t.status === 'ACTIVE');
  const sources = tubes.filter(
    (t) =>
      t.kind === 'COLLECTION' && t.status === 'ACTIVE' && t.confirmed && t.purposeId === purposeId,
  );
  const formSources = tubes.filter(
    (t) =>
      t.kind === 'COLLECTION' &&
      t.status === 'ACTIVE' &&
      t.confirmed &&
      t.purposeId === watchedPurpose &&
      t.animalNo === watchedAnimal &&
      t.collectDate === watchedDate &&
      t.timePoint === watchedTime,
  );
  function edit(t: Tube | 'new', action: 'edit' | 'reissue' = 'edit') {
    setEditing(t);
    setMode(action);
    setValidation('');
    form.setFieldsValue(
      t === 'new'
        ? {
            animalNo: '',
            timePoint: '',
            labelInfo: '',
            collectDate: '',
            purposeId: '',
            sourceTubeId: '',
            expiresAt: '',
            reason: '',
          }
        : {
            ...t,
            expiresAt: t.expiresAt ? shanghaiTime(t.expiresAt).replace(' ', 'T').slice(0, 16) : '',
            reason: '',
          },
    );
  }
  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (editing !== 'new' && !values.reason?.trim()) {
      setValidation('请填写原因');
      return;
    }
    const body = {
      kind,
      animalNo: values.animalNo,
      timePoint: values.timePoint,
      labelInfo: values.labelInfo,
      collectDate: values.collectDate,
      purposeId: values.purposeId || '',
      confirmed: !!values.purposeId,
      sourceTubeId: values.sourceTubeId || '',
      expiresAt: values.expiresAt ? new Date(`${values.expiresAt}+08:00`).toISOString() : '',
      ...(editing !== 'new' ? { reason: values.reason } : {}),
    };
    const suffix =
      editing !== 'new' && editing ? `/${editing.id}${mode === 'reissue' ? '/reissue' : ''}` : '';
    void command.execute(`${experimentPath(projectId)}/tubes${suffix}`, body);
  }
  function assign() {
    if (!purposeId) {
      setValidation('请选择批量用途');
      return;
    }
    if (!reason.trim()) {
      setValidation('请填写原因');
      return;
    }
    void command.execute(`${experimentPath(projectId)}/tube-assignments`, {
      confirmed: true,
      reason,
      assignments: selected.map((tubeId) => ({
        tubeId,
        purposeId,
        ...(sourceId ? { sourceTubeId: sourceId } : {}),
      })),
    });
  }
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <SectionTitle title={`${name}列表`}>
        <Button disabled={blocked} onClick={() => edit('new')}>
          新增{name}
        </Button>
      </SectionTitle>
      <Alert
        type="info"
        message="每支管有独立标签码。内容更正或替换会生成新身份并作废旧码；补打同一支管请在标签打印页选择原管，保持原标签码。采样日期始终是原始采血日期。"
      />
      <Space wrap>
        <Input.Search
          aria-label="查找管子"
          placeholder="动物、时间点、原始管标、日期或标签码"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onSearch={setSearch}
          allowClear
          style={{ width: 340 }}
        />
        <NativeSelect
          label="管子状态"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ACTIVE', label: '有效' },
            { value: 'VOID', label: '已作废' },
          ]}
          placeholder="全部状态"
        />
      </Space>
      <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      {saved && <Alert type="success" message={saved} />}{' '}
      {validation && !editing && !voiding && <Alert type="error" message={validation} />}
      <Space wrap className="experiment-toolbar">
        <span>已选 {selected.length} 支（最多1000）</span>
        <Button disabled={blocked || !selectable.length} onClick={() => setSelected(selectable.slice(0, 1000).map((t) => t.id))}>
          全选筛选结果（最多1000支）
        </Button>
        <Button disabled={blocked || !selected.length} onClick={() => setSelected([])}>
          清空选择
        </Button>
        <NativeSelect
          label="批量用途"
          value={purposeId}
          onChange={(v) => {
            setPurposeId(v);
            setSourceId('');
          }}
          options={purposeOptions(purposes)}
          disabled={blocked}
        />
        {kind === 'ALIQUOT' && (
          <NativeSelect
            label="批量来源采血管"
            value={sourceId}
            onChange={setSourceId}
            options={sources.map((t) => ({
              value: t.id,
              label: `${t.animalNo} · ${t.collectDate} · ${t.timePoint} · ${t.id}`,
            }))}
            disabled={blocked}
          />
        )}
        <Input
          aria-label="批量更正原因"
          placeholder="批量更正原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={blocked}
          style={{ width: 220 }}
        />
        <Button disabled={blocked || !selected.length || selected.length > 1000} onClick={assign}>
          确认批量归类与配对
        </Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={rows}
        pagination={{ ...experimentPagination }}
        scroll={{ x: 1500 }}
        columns={[
          {
            title: (
              <Checkbox
                aria-label="选择筛选结果（最多1000支）"
                checked={
                  !!selectable.length &&
                  selectable.every((t) => selected.includes(t.id))
                }
                disabled={blocked || !selectable.length}
                indeterminate={selectable.some((t) => selected.includes(t.id)) && !selectable.every((t) => selected.includes(t.id))}
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? rows
                          .filter((t) => t.status === 'ACTIVE')
                          .slice(0, 1000)
                          .map((t) => t.id)
                      : [],
                  )
                }
              />
            ),
            render: (_, t) => (
              <Checkbox
                aria-label={`选择管子 ${t.id}`}
                disabled={blocked || t.status === 'VOID'}
                checked={selected.includes(t.id)}
                onChange={(e) =>
                  setSelected((prev) =>
                    e.target.checked ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                  )
                }
              />
            ),
          },
          { title: '试验编号', dataIndex: 'projectCode' },
          { title: '动物号', dataIndex: 'animalNo' },
          { title: '时间点', dataIndex: 'timePoint' },
          {
            title: '管标信息（原文）',
            dataIndex: 'labelInfo',
            render: (v: string) => <span className="preserve-text">{v}</span>,
          },
          { title: '采样日期', dataIndex: 'collectDate' },
          {
            title: '用途 / 来源',
            render: (_, t) => (
              <>
                {purposes.find((p) => p.id === t.purposeId)?.name || '待归类'}
                <br />
                {kind === 'ALIQUOT' ? t.sourceTubeId || '待明确配对' : ''}
              </>
            ),
          },
          {
            title: '状态 / 打印',
            render: (_, t) => (
              <>
                <Tag
                  color={
                    t.status === 'VOID'
                      ? 'red'
                      : t.confirmed && (kind === 'COLLECTION' || t.sourceTubeId)
                        ? 'green'
                        : 'orange'
                  }
                >
                  {t.status === 'VOID' ? '已作废' : t.confirmed ? '已确认' : '待确认'}
                </Tag>
                <br />
                {t.printed ? '已登记打印请求' : '未登记打印请求'}
                <br />v{t.version}
              </>
            ),
          },
          {
            title: '操作',
            fixed: 'right',
            render: (_, t) => (
              <Space direction="vertical">
                <Button onClick={() => setDetail(t)}>详情 {t.id}</Button>
                <Button
                  aria-label={`更正 ${t.id}`}
                  disabled={blocked || t.status === 'VOID'}
                  onClick={() => edit(t)}
                >
                  更正
                </Button>
                <Button
                  disabled={blocked || t.status === 'VOID'}
                  onClick={() => edit(t, 'reissue')}
                >
                  替换新管
                </Button>
                <Button
                  danger
                  disabled={blocked || t.status === 'VOID'}
                  onClick={() => {
                    setVoiding(t);
                    setReason('');
                    setValidation('');
                  }}
                >
                  作废
                </Button>
                {hasPermission('audit:view') && (
                  <Button
                    onClick={() =>
                      void http
                        .get<ExperimentEvent[]>(
                          `${experimentPath(projectId)}/changes?keyword=${encodeURIComponent(t.id)}`,
                        )
                        .then(setEvents)
                        .catch((e) => setValidation(errorText(e)))
                    }
                  >
                    资料历史
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      <Modal
        width={680}
        title={
          editing === 'new'
            ? `新增${name}`
            : mode === 'reissue'
              ? '替换新管（新标签码）'
              : '更正管子内容'
        }
        open={!!editing}
        onCancel={() => {
          if (!command.pending && !command.busy) setEditing(null);
        }}
        footer={
          <Button
            type="primary"
            disabled={blocked}
            loading={command.busy}
            onClick={() => void save()}
          >
            {editing === 'new' ? '保存新管' : mode === 'reissue' ? '确认替换新管' : '保存更正'}
          </Button>
        }
      >
        {editing !== 'new' && (
          <Alert
            type="warning"
            message="旧标签码将作废。原内容与核对历史保留；保存后打印新管标签并替换，不能沿用旧标签。"
          />
        )}
        <Form
          layout="vertical"
          form={form}
          disabled={blocked}
          onValuesChange={(changes) => {
            if (['animalNo', 'collectDate', 'timePoint', 'purposeId'].some((key) => key in changes))
              form.setFieldValue('sourceTubeId', '');
          }}
        >
          <Form.Item
            label="动物号"
            name="animalNo"
            rules={[{ required: true, message: '请填写动物号' }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            label="时间点"
            name="timePoint"
            rules={[{ required: true, message: '请填写时间点' }]}
          >
            <Input maxLength={2000} />
          </Form.Item>
          <Form.Item
            label="管标信息"
            name="labelInfo"
            rules={[{ required: true, message: '请填写管标信息' }]}
          >
            <Input.TextArea rows={3} maxLength={2000} />
          </Form.Item>
          <Form.Item
            label="采样日期"
            name="collectDate"
            rules={[{ required: true, message: '请选择采样日期' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item label="确认用途" name="purposeId">
            <select aria-label="确认用途" disabled={blocked}>
              <option value="">暂存待归类</option>
              {purposeOptions(purposes).map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Form.Item>
          {kind === 'ALIQUOT' && (
            <Form.Item label="来源采血管" name="sourceTubeId">
              <select aria-label="来源采血管" disabled={blocked}>
                <option value="">唯一匹配时自动配对，否则待明确来源</option>
                {formSources.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} · {t.labelInfo}
                  </option>
                ))}
              </select>
            </Form.Item>
          )}
          <Form.Item label="可选失效时间" name="expiresAt">
            <Input type="datetime-local" />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item label="更正原因" name="reason">
              <Input.TextArea />
            </Form.Item>
          )}
        </Form>
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
      <Modal
        title={`作废 ${voiding?.id || ''}`}
        open={!!voiding}
        onCancel={() => {
          if (!command.pending && !command.busy) setVoiding(null);
        }}
        footer={
          <Button
            danger
            disabled={blocked}
            onClick={() => {
              if (!reason.trim()) {
                setValidation('请填写原因');
                return;
              }
              void command.execute(`${experimentPath(projectId)}/tubes/${voiding?.id}/void`, {
                reason,
              });
            }}
          >
            确认作废
          </Button>
        }
      >
        <Alert type="warning" message="作废后旧标签码不能再打印或核对，历史记录仍保留。" />
        <Input.TextArea
          aria-label="作废原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
      <Modal title="管子详情" open={!!detail} onCancel={() => setDetail(null)} footer={null}>
        <TubeFields tube={detail || undefined} />
        <Snapshot
          value={
            detail
              ? {
                  status: detail.status,
                  printed: detail.printed,
                  confirmed: detail.confirmed,
                  purposeId: detail.purposeId,
                  sourceTubeId: detail.sourceTubeId,
                  expiresAt: detail.expiresAt,
                  voidReason: detail.voidReason,
                  importId: detail.importId,
                  sourceSheet: detail.sourceSheet,
                  sourceRow: detail.sourceRow,
                }
              : undefined
          }
        />
        <Collapse
          items={[
            { key: 'raw', label: '展开完整管子归档', children: <JsonDetail value={detail} /> },
          ]}
        />
      </Modal>
      <Modal
        title="资料历史（保留原快照）"
        open={events !== null}
        onCancel={() => setEvents(null)}
        footer={null}
      >
        {events?.map((e) => (
          <div key={e.id}>
            <p>
              {shanghaiTime(e.createdAt)} · {e.actorName} · {e.reason}
            </p>
            <EventDetails event={e} />
          </div>
        ))}
      </Modal>
    </Space>
  );
}
