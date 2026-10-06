import { Alert, Button, Input, Modal, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { experimentApi, experimentPath } from '../../api/experiments';
import { http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import { humanizeApiMessage } from '../../utils/apiMessage';
import type { ExperimentEvent, Purpose } from '../../types/experiments';
import { EventDetails } from './EventDetails';
import { errorText, NativeSelect, shanghaiTime } from './shared';
const resultNames = {
  CHANGE: '资料更改',
  READY: '已接收',
  PASS: '通过',
  FAIL: '失败',
  ABORT: '异常结束',
};
export function RecordsPanel({
  projectId,
  changes,
  purposes,
}: {
  projectId: number;
  changes: boolean;
  purposes: Purpose[];
}) {
  const { hasPermission } = useAuth();
  const permitted = hasPermission(changes ? 'audit:view' : 'record:view');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<ExperimentEvent[]>([]);
  const [detail, setDetail] = useState<ExperimentEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);
  const currentDetail = useRef(0);
  const alive = useRef(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!permitted) return;
    let active = true;
    alive.current = true;
    currentDetail.current++;
    const number = ++seq.current;
    setLoading(true);
    setError('');
    void experimentApi
      .events(projectId, changes, query)
      .then((data) => {
        if (active && number === seq.current) setRecords(data);
      })
      .catch((e) => {
        if (active && number === seq.current) {
          setError(errorText(e));
          setRecords([]);
        }
      })
      .finally(() => {
        if (active && number === seq.current) setLoading(false);
      });
    return () => {
      active = false;
      alive.current = false;
    };
  }, [projectId, changes, query, permitted, reload]);
  const update = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const queryString = () => {
    const values = new URLSearchParams(Object.entries(filters).filter(([, v]) => !!v));
    return values.size ? `?${values.toString()}` : '';
  };
  async function openDetail(id: string) {
    const token = ++currentDetail.current;
    try {
      const event = await http.get<ExperimentEvent>(
        `${experimentPath(projectId)}/${changes ? 'changes' : 'records'}/${id}`,
      );
      if (alive.current && token === currentDetail.current) setDetail(event);
    } catch (e) {
      if (alive.current && token === currentDetail.current) setError(errorText(e));
    }
  }
  if (!permitted)
    return (
      <Alert
        type="warning"
        message={`当前账号没有${changes ? '资料更改记录' : '核对记录'}查看权限`}
      />
    );
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <Typography.Title level={4}>
        {changes ? '资料更改记录' : '核对记录'}（不可变快照）
      </Typography.Title>
      <Alert
        type="info"
        message="采样日期是原始采血日期，记录时间是服务器保存操作的时间。失败、纠正通过与异常结束分别保留；详情显示当时内容及版本。"
      />
      <div className="experiment-filter-grid">
        <label className="experiment-field">
          <span>采样日期</span>
          <Input
            aria-label="筛选采样日期"
            type="date"
            value={filters.collectDate || ''}
            onChange={(e) => update('collectDate', e.target.value)}
          />
        </label>
        <label className="experiment-field">
          <span>动物号</span>
          <Input
            aria-label="筛选动物号"
            value={filters.animalNo || ''}
            onChange={(e) => update('animalNo', e.target.value)}
          />
        </label>
        <label className="experiment-field">
          <span>时间点</span>
          <Input
            aria-label="筛选时间点"
            value={filters.timePoint || ''}
            onChange={(e) => update('timePoint', e.target.value)}
          />
        </label>
        <NativeSelect
          label="筛选用途"
          value={filters.purposeId || ''}
          onChange={(v) => update('purposeId', v)}
          options={purposes.map((p) => ({
            value: p.id,
            label: `${p.name}${p.active ? '' : '（已停用）'}`,
          }))}
          placeholder="全部用途"
        />
        <NativeSelect
          label="筛选阶段"
          value={filters.stage || ''}
          onChange={(v) => update('stage', v)}
          options={[
            { value: 'COLLECTION', label: '采血' },
            { value: 'ALIQUOT', label: '血样处理' },
          ]}
          placeholder="全部阶段"
        />
        <NativeSelect
          label="筛选结果"
          value={filters.result || ''}
          onChange={(v) => update('result', v)}
          options={Object.entries(resultNames).map(([value, label]) => ({
            value,
            label,
          }))}
          placeholder="全部结果"
        />
        <label className="experiment-field">
          <span>操作人员</span>
          <Input
            aria-label="筛选操作人员"
            value={filters.actorName || ''}
            onChange={(e) => update('actorName', e.target.value)}
          />
        </label>
        <label className="experiment-field">
          <span>归档关键字 / 二维码</span>
          <Input
            aria-label="筛选归档关键字"
            value={filters.keyword || ''}
            onChange={(e) => update('keyword', e.target.value)}
          />
        </label>
      </div>
      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            const next = queryString();
            if (next === query) setReload((value) => value + 1);
            else setQuery(next);
          }}
        >
          查询记录
        </Button>
        <Button
          onClick={() => {
            setFilters({});
            setQuery('');
          }}
        >
          清空筛选
        </Button>
        <Button
          disabled={loading}
          onClick={() =>
            void http
              .download(
                `${experimentPath(projectId)}/${changes ? 'changes' : 'records'}/export${query}`,
                `${changes ? '资料更改' : '核对记录'}-${projectId}.csv`,
              )
              .catch((e) => setError(errorText(e)))
          }
        >
          导出当前查询 CSV
        </Button>
      </Space>
      {error && <Alert type="error" message={error} />}
      <Table
        loading={loading}
        rowKey="id"
        dataSource={records}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1050 }}
        columns={[
          { title: '采样日期', dataIndex: 'collectDate' },
          { title: '动物号', dataIndex: 'animalNo' },
          { title: '时间点', dataIndex: 'timePoint' },
          {
            title: '阶段',
            render: (_, e) =>
              e.stage === 'COLLECTION' ? '采血' : e.stage === 'ALIQUOT' ? '血样处理' : '资料管理',
          },
          {
            title: '结果',
            render: (_, e) => (
              <Tag
                color={
                  e.result === 'PASS'
                    ? 'green'
                    : e.result === 'FAIL'
                      ? 'red'
                      : e.result === 'ABORT'
                        ? 'orange'
                        : 'blue'
                }
              >
                {resultNames[e.result]}
              </Tag>
            ),
          },
          {
            title: '具体提示 / 原因',
            render: (_, e) => humanizeApiMessage(e.message) || e.remark || e.reason || '—',
          },
          { title: '操作人员', dataIndex: 'actorName' },
          {
            title: '保存时间（上海）',
            render: (_, e) => shanghaiTime(e.createdAt),
          },
          {
            title: '详情',
            render: (_, e) => (
              <Button aria-label={`详情 ${e.id}`} onClick={() => void openDetail(e.id)}>
                查看详情
              </Button>
            ),
          },
        ]}
      />
      <Modal
        width={900}
        title="当时记录详情"
        open={!!detail}
        onCancel={() => {
          currentDetail.current++;
          setDetail(null);
        }}
        footer={null}
      >
        {detail && <EventDetails event={detail} />}
      </Modal>
    </Space>
  );
}
