import { Alert, Button, Checkbox, Input, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { experimentApi, experimentPath } from '../../api/experiments';
import { ApiError, http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import { humanizeApiMessage } from '../../utils/apiMessage';
import type { ImportBatch, ImportKind, ImportRow, Purpose, Tube } from '../../types/experiments';
import {
  CommandFeedback,
  errorText,
  NativeSelect,
  purposeOptions,
  SectionTitle,
  shanghaiTime,
  useCommand,
} from './shared';
interface Assignment {
  purposeId: string;
  sourceTubeId?: string;
}
const importStatus = {
  PREVIEW: '待确认',
  INVALID: '附件有错误',
  REJECTED: '确认未通过',
  COMMITTED: '已完整导入',
};
const kindNames = {
  GROUP: '分组表',
  COLLECTION: '采血管表',
  ALIQUOT: '分装管表',
};
export function ImportsPanel({
  projectId,
  purposes,
  tubes,
  refresh,
}: {
  projectId: number;
  purposes: Purpose[];
  tubes: Tube[];
  refresh: () => Promise<void>;
}) {
  const { hasPermission } = useAuth();
  const allowed = hasPermission('sample:generate');
  const [kind, setKind] = useState<ImportKind>('COLLECTION');
  const [history, setHistory] = useState<ImportBatch[]>([]);
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [assignments, setAssignments] = useState<Record<string, Assignment>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkPurpose, setBulkPurpose] = useState('');
  const [bulkSource, setBulkSource] = useState('');
  const [acknowledge, setAcknowledge] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const uploadAction = useRef<{
    file: File;
    kind: ImportKind;
    requestId: string;
  } | null>(null);
  const [uploadUnknown, setUploadUnknown] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const loadSequence = useRef(0);
  const loadHistory = () => experimentApi.imports(projectId).then(setHistory);
  useEffect(() => {
    let active = true;
    if (allowed)
      void experimentApi
        .imports(projectId)
        .then((data) => {
          if (active) setHistory(data);
        })
        .catch((e) => {
          if (active) setUploadError(errorText(e));
        });
    return () => {
      active = false;
    };
  }, [projectId, allowed]);
  function showBatch(value: ImportBatch) {
    setBatch(value);
    setKind(value.kind);
    setSelected([]);
    setAcknowledge(false);
    setMessage('');
    setAssignments(
      Object.fromEntries(
        value.rows.map((row) => [row.rowKey, { purposeId: row.suggestedPurposeId || '' }]),
      ),
    );
  }
  const command = useCommand<ImportBatch>(
    async (value) => {
      setBatch(value);
      setAcknowledge(false);
      if (value.status === 'COMMITTED') {
        setMessage('已完整导入');
        await refresh();
        await loadHistory();
      } else {
        setMessage('导入未完成，请检查确认问题。没有行被部分导入。');
      }
    },
    async (error, path) => {
      const batchId = path.match(/\/imports\/([^/]+)\/commit$/)?.[1];
      if (error.status === 409 && batchId) {
        const latest = await experimentApi.batch(projectId, batchId);
        if (!batch) showBatch(latest);
        setBatch(latest);
        setAcknowledge(false);
        setMessage('提交时发现疑似重复，请检查最新候选并明确确认追加。');
      }
    },
    `${projectId}:import-commit`,
  );
  const busy = loading || command.busy || !!command.pending || uploadUnknown;
  const duplicates = !!batch && (batch.duplicate || !!batch.duplicateRows?.length);
  async function preview(action: { file: File; kind: ImportKind; requestId: string }) {
    if (loading) return;
    setLoading(true);
    setUploadError('');
    const form = new FormData();
    form.append('file', action.file);
    form.append('kind', action.kind);
    form.append('requestId', action.requestId);
    try {
      const result = await http.multipart<ImportBatch>(
        `${experimentPath(projectId)}/imports/preview`,
        form,
      );
      uploadAction.current = null;
      setUploadUnknown(false);
      showBatch(result);
      await loadHistory();
    } catch (e) {
      const uncertain = e instanceof ApiError && e.uncertain;
      setUploadUnknown(uncertain);
      setUploadError(
        uncertain ? `结果未确认：${errorText(e)}。保留原附件，请重试预览。` : errorText(e),
      );
      if (!uncertain) uploadAction.current = null;
    } finally {
      setLoading(false);
    }
  }
  async function choose(id: string) {
    const seq = ++loadSequence.current;
    setLoading(true);
    setUploadError('');
    try {
      const result = await experimentApi.batch(projectId, id);
      if (seq === loadSequence.current) showBatch(result);
    } catch (e) {
      setUploadError(errorText(e));
    } finally {
      if (seq === loadSequence.current) setLoading(false);
    }
  }
  function sourceOptions(row: ImportRow, purposeId: string) {
    return tubes
      .filter(
        (t) =>
          t.kind === 'COLLECTION' &&
          t.status === 'ACTIVE' &&
          t.confirmed &&
          t.purposeId === purposeId &&
          t.animalNo === row.animalNo &&
          t.collectDate === row.collectDate &&
          t.timePoint === row.timePoint,
      )
      .map((t) => ({
        value: t.id,
        label: `${t.animalNo} · ${t.timePoint} · ${t.labelInfo} · ${t.id}`,
      }));
  }
  function applyBulk() {
    if (!bulkPurpose) {
      setMessage('请选择批量用途');
      return;
    }
    const next = { ...assignments };
    for (const key of selected) {
      next[key] = {
        purposeId: bulkPurpose,
        ...(bulkSource ? { sourceTubeId: bulkSource } : {}),
      };
    }
    setAssignments(next);
    setMessage(`已对 ${selected.length} 行设置用途建议，请确认后提交。`);
  }
  const noPurpose =
    batch?.kind !== 'GROUP' && batch?.rows.some((row) => !assignments[row.rowKey]?.purposeId);
  const needsSource =
    batch?.kind === 'ALIQUOT' &&
    batch.rows.some(
      (row) =>
        sourceOptions(row, assignments[row.rowKey]?.purposeId || '').length !== 1 &&
        !assignments[row.rowKey]?.sourceTubeId,
    );
  if (!allowed) return <Alert type="warning" message="当前账号没有附件导入权限" />;
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <SectionTitle title="附件导入与原件历史" />
      <Alert
        type="info"
        message="分组表固定三列：试验编号、动物号、芯片号。采血与分装表固定五列：试验编号、动物号、时间点、管标信息、采样日期。每行是一支管，支持 xls / xlsx，上限 8 MB。"
      />
      <Space wrap>
        <NativeSelect
          label="附件类型"
          value={kind}
          onChange={(v) => setKind(v as ImportKind)}
          options={Object.entries(kindNames).map(([value, label]) => ({
            value,
            label,
          }))}
          disabled={busy}
        />
        <Button
          disabled={busy}
          onClick={() =>
            void http
              .download(`/api/experiments/templates/${kind}`, `${kindNames[kind]}模板.xlsx`)
              .catch((e) => setUploadError(errorText(e)))
          }
        >
          下载{kindNames[kind]}模板
        </Button>
        <label className="experiment-upload">
          上传 Excel 附件
          <input
            aria-label="上传 Excel 附件"
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 8 * 1024 * 1024) {
                  setUploadError('附件不能超过 8 MB');
                  return;
                }
                const action = { file, kind, requestId: crypto.randomUUID() };
                uploadAction.current = action;
                void preview(action);
              }
              e.target.value = '';
            }}
          />
        </label>
      </Space>
      {uploadError && (
        <Alert
          type={uploadUnknown ? 'warning' : 'error'}
          message={uploadError}
          action={
            uploadUnknown ? (
              <Button
                loading={loading}
                onClick={() => {
                  if (uploadAction.current) void preview(uploadAction.current);
                }}
              >
                重试原附件预览
              </Button>
            ) : undefined
          }
        />
      )}
      <CommandFeedback command={command} allowed={allowed} />
      {message && (
        <Alert message={message} type={batch?.status === 'COMMITTED' ? 'success' : 'info'} />
      )}
      {batch && (
        <div className="content-panel">
          <Typography.Title level={4}>
            {batch.fileName} · {kindNames[batch.kind]}
          </Typography.Title>
          <Space wrap>
            <Tag>{importStatus[batch.status]}</Tag>
            <span>
              {batch.rows.length} 行 · 批次 {batch.id}
            </span>
            <Button
              onClick={() =>
                void http
                  .download(
                    `${experimentPath(projectId)}/imports/${batch.id}/original`,
                    batch.fileName,
                  )
                  .catch((e) => setUploadError(errorText(e)))
              }
            >
              下载当前原附件
            </Button>
          </Space>
          {!![...batch.issues, ...(batch.commitIssues || [])].length && (
            <Table
              data-testid="import-issues"
              rowKey={(_, index) => String(index)}
              dataSource={[...batch.issues, ...(batch.commitIssues || [])]}
              columns={[
                { title: '工作表', dataIndex: 'sheet' },
                { title: '行号', dataIndex: 'row' },
                { title: '列名', dataIndex: 'column' },
                {
                  title: '问题',
                  dataIndex: 'message',
                  render: (message: string) => humanizeApiMessage(message),
                },
              ]}
              pagination={{ pageSize: 20 }}
            />
          )}
          {duplicates && (
            <div data-testid="duplicate-candidates" className="experiment-warning">
              <Typography.Title level={5}>疑似重复内容（确认后仍逐行追加）</Typography.Title>
              {batch.duplicateBatches?.map((b) => (
                <p key={b.importId}>
                  同文件批次：{b.importId} · {b.fileName} · {b.status}
                </p>
              ))}
              {!!batch.duplicateRows?.length && (
                <Table
                  rowKey={(_, i) => String(i)}
                  dataSource={batch.duplicateRows}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 800 }}
                  columns={[
                    { title: '当前行', dataIndex: 'rowKey' },
                    {
                      title: '来源批次',
                      render: (_, d) => d.importId || '手工管 / 本附件',
                    },
                    {
                      title: '来源工作表 / 行',
                      render: (_, d) =>
                        `${d.sourceSheet || d.matchingRowKey || '—'} / ${d.sourceRow || '—'}`,
                    },
                    {
                      title: '管子 / 状态',
                      render: (_, d) => `${d.tubeId || '本附件内相同行'} / ${d.status || '—'}`,
                    },
                    {
                      title: '五项原始内容',
                      render: (_, d) =>
                        [
                          d.content.projectCode,
                          d.content.animalNo,
                          d.content.timePoint,
                          d.content.labelInfo,
                          d.content.collectDate,
                        ].join(' · '),
                    },
                  ]}
                />
              )}
              <p>候选上限 {batch.duplicateRowsLimit || 10000} 条，不自动合并或丢弃相同内容管子。</p>
              <Checkbox
                checked={acknowledge}
                disabled={busy}
                onChange={(e) => setAcknowledge(e.target.checked)}
              >
                我确认以上疑似重复内容仍需追加，每行创建独立管子
              </Checkbox>
            </div>
          )}
          {batch.kind !== 'GROUP' && (
            <Space wrap className="experiment-toolbar">
              <NativeSelect
                label="批量用途"
                value={bulkPurpose}
                onChange={(v) => {
                  setBulkPurpose(v);
                  setBulkSource('');
                }}
                options={purposeOptions(purposes)}
                disabled={busy}
              />
              {batch.kind === 'ALIQUOT' && (
                <NativeSelect
                  label="批量来源采血管"
                  value={bulkSource}
                  onChange={setBulkSource}
                  options={tubes
                    .filter(
                      (t) =>
                        t.kind === 'COLLECTION' &&
                        t.status === 'ACTIVE' &&
                        t.purposeId === bulkPurpose,
                    )
                    .map((t) => ({
                      value: t.id,
                      label: `${t.animalNo} · ${t.collectDate} · ${t.timePoint} · ${t.id}`,
                    }))}
                  disabled={busy}
                />
              )}
              <Button
                disabled={busy || !selected.length || batch.status === 'COMMITTED'}
                onClick={applyBulk}
              >
                应用到选中行（{selected.length}）
              </Button>
              <Input.Search
                placeholder="按动物或管标筛选后勾选"
                onSearch={(value) =>
                  setSelected(
                    batch.rows
                      .filter((r) => `${r.animalNo} ${r.labelInfo}`.includes(value))
                      .map((r) => r.rowKey),
                  )
                }
                style={{ width: 260 }}
              />
            </Space>
          )}
          <Table
            rowKey="rowKey"
            dataSource={batch.rows}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100],
            }}
            scroll={{ x: 1000 }}
            rowSelection={
              batch.kind === 'GROUP'
                ? undefined
                : {
                    selectedRowKeys: selected,
                    onChange: (keys) => setSelected(keys.map(String)),
                    getCheckboxProps: () => ({
                      disabled: busy || batch.status === 'COMMITTED',
                    }),
                  }
            }
            columns={[
              {
                title: '工作表 / 行',
                render: (_, r) => `${r.sourceSheet} / ${r.sourceRow}`,
              },
              { title: '试验编号', dataIndex: 'projectCode' },
              { title: '动物号', dataIndex: 'animalNo' },
              ...(batch.kind === 'GROUP'
                ? [{ title: '芯片号', dataIndex: 'chipNo' }]
                : [
                    { title: '时间点', dataIndex: 'timePoint' },
                    {
                      title: '管标信息',
                      dataIndex: 'labelInfo',
                      render: (value: string) => <span className="preserve-text">{value}</span>,
                    },
                    { title: '采样日期', dataIndex: 'collectDate' },
                    {
                      title: '用途识别（需确认）',
                      render: (_: unknown, r: ImportRow) => (
                        <NativeSelect
                          label={`用途 ${r.rowKey}`}
                          value={assignments[r.rowKey]?.purposeId || ''}
                          disabled={busy || batch.status === 'COMMITTED'}
                          onChange={(v) =>
                            setAssignments((prev) => ({
                              ...prev,
                              [r.rowKey]: { purposeId: v },
                            }))
                          }
                          options={purposeOptions(purposes)}
                        />
                      ),
                    },
                  ]),
              ...(batch.kind === 'ALIQUOT'
                ? [
                    {
                      title: '明确来源采血管',
                      render: (_: unknown, r: ImportRow) => {
                        const options = sourceOptions(r, assignments[r.rowKey]?.purposeId || '');
                        return (
                          <NativeSelect
                            label={`来源 ${r.rowKey}`}
                            placeholder={
                              options.length === 1 ? '唯一匹配，服务器确认' : '请选择明确来源'
                            }
                            value={assignments[r.rowKey]?.sourceTubeId || ''}
                            options={options}
                            disabled={busy || batch.status === 'COMMITTED'}
                            onChange={(v) =>
                              setAssignments((prev) => ({
                                ...prev,
                                [r.rowKey]: {
                                  ...prev[r.rowKey],
                                  sourceTubeId: v,
                                },
                              }))
                            }
                          />
                        );
                      },
                    },
                  ]
                : []),
            ]}
          />
          {noPurpose && <Alert type="warning" message="有行尚未确定用途，请手动批量归类。" />}
          {needsSource && (
            <Alert type="warning" message="有分装行的来源不唯一或缺失，请明确选择来源采血管。" />
          )}
          <Button
            type="primary"
            disabled={
              busy ||
              batch.status === 'INVALID' ||
              batch.status === 'COMMITTED' ||
              !!batch.issues.length ||
              !!noPurpose ||
              !!needsSource ||
              (duplicates && !acknowledge)
            }
            loading={command.busy}
            onClick={() =>
              void command.execute(`${experimentPath(projectId)}/imports/${batch.id}/commit`, {
                confirmed: true,
                ...(duplicates ? { acknowledgeDuplicate: acknowledge } : {}),
                ...(batch.kind === 'GROUP'
                  ? {}
                  : {
                      assignments: batch.rows.map((r) => ({
                        rowKey: r.rowKey,
                        ...assignments[r.rowKey],
                      })),
                    }),
              })
            }
          >
            {batch.kind === 'GROUP' ? '确认分组并追加导入' : '确认用途并追加导入'}
          </Button>
        </div>
      )}
      <Typography.Title level={4}>附件历史</Typography.Title>
      <Table
        rowKey="id"
        dataSource={history}
        scroll={{ x: 750 }}
        columns={[
          { title: '原文件', dataIndex: 'fileName' },
          { title: '类型', render: (_, b) => kindNames[b.kind] },
          { title: '状态', render: (_, b) => importStatus[b.status] },
          {
            title: '上传时间（上海）',
            render: (_, b) => shanghaiTime(b.createdAt),
          },
          { title: '行数', render: (_, b) => b.rows.length },
          {
            title: '操作',
            render: (_, b) => (
              <Space>
                <Button disabled={busy} onClick={() => void choose(b.id)}>
                  查看批次
                </Button>
                <Button
                  onClick={() =>
                    void http
                      .download(`${experimentPath(projectId)}/imports/${b.id}/original`, b.fileName)
                      .catch((e) => setUploadError(errorText(e)))
                  }
                >
                  下载原件
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </Space>
  );
}
