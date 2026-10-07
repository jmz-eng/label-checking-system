import { Collapse, Descriptions, Typography } from 'antd';
import { humanizeApiMessage } from '../../utils/apiMessage';
import type { ExperimentEvent, Mapping, Purpose, Tube } from '../../types/experiments';
import { JsonDetail, shanghaiTime, TubeFields } from './shared';
const fieldNames: Record<string, string> = {
  id: '身份编号',
  projectId: '实验编号',
  projectCode: '试验编号',
  projectName: '实验名称',
  animalNo: '动物号',
  chipNo: '芯片号',
  kind: '管子类型',
  timePoint: '时间点',
  labelInfo: '管标信息',
  collectDate: '采样日期',
  purposeId: '用途身份',
  sourceTubeId: '来源采血管身份',
  targetTubeId: '目标管身份',
  code: '原标签码',
  barcode: '条形码',
  status: '状态',
  confirmed: '确认状态',
  printed: '已登记打印请求',
  version: '版本',
  active: '有效状态',
  replacesId: '替换的旧管身份',
  voidReason: '作废原因',
  name: '用途名称',
  collectionKeywords: '采血关键词',
  aliquotKeywords: '分装关键词',
  createdAt: '保存时间（上海）',
  expiresAt: '失效时间（上海）',
  importId: '附件批次',
  sourceSheet: '原工作表',
  sourceRow: '原始行号',
  fileName: '文件名',
  hash: '附件校验值',
  count: '数量',
  ownerId: '操作账号',
  round: '轮次',
  stage: '核对阶段',
  pending: '等待操作',
  state: '本轮状态',
  chipContent: '扫描芯片内容',
  mappingSnapshot: '分组关系快照',
  sourceSnapshot: '来源管快照',
  purposeSnapshot: '用途规则快照',
  rows: '原始数据行',
  issues: '附件问题',
  sheet: '工作表',
  row: '行号',
  column: '列名',
  message: '提示内容',
  entityIds: '导入的身份清单',
};
const names: Record<string, string> = {
  ACTIVE: '有效',
  VOID: '已作废',
  COLLECTION: '采血',
  ALIQUOT: '分装',
  PASS: '通过',
  FAIL: '失败',
  ABORT: '异常结束',
  READY: '已接收（尚未通过）',
  CHANGE: '资料更改',
  FAILED: '失败未处理',
  PASSED: '本轮通过',
  ABORTED: '异常结束',
  IN_PROGRESS: '核对中',
  SUPERSEDED: '已结束并更换条件',
};
export function Snapshot({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value !== 'object')
    return (
      <span className="preserve-text">
        {typeof value === 'boolean' ? (value ? '是' : '否') : names[String(value)] || String(value)}
      </span>
    );
  if (Array.isArray(value))
    return (
      <div>
        {value.map((item, i) => (
          <div key={i}>
            <Snapshot value={item} />
          </div>
        ))}
      </div>
    );
  const pairs = Object.entries(value).filter(([key]) => fieldNames[key]);
  return (
    <Descriptions
      bordered
      size="small"
      column={1}
      items={pairs.map(([key, item]) => ({
        key,
        label: fieldNames[key],
        children:
          key === 'createdAt' || key === 'expiresAt' ? (
            shanghaiTime(String(item || ''))
          ) : (
            <Snapshot value={item} />
          ),
      }))}
    />
  );
}
function MappingInfo({ mapping }: { mapping?: Mapping }) {
  return mapping ? (
    <Snapshot
      value={{
        animalNo: mapping.animalNo,
        chipNo: mapping.chipNo,
        version: mapping.version,
      }}
    />
  ) : null;
}
function PurposeInfo({ purpose }: { purpose?: Purpose }) {
  return purpose ? (
    <Snapshot
      value={{
        name: purpose.name,
        collectionKeywords: purpose.collectionKeywords,
        aliquotKeywords: purpose.aliquotKeywords,
        version: purpose.version,
      }}
    />
  ) : null;
}
function TubeInfo({ tube }: { tube?: Tube }) {
  return tube ? <TubeFields tube={tube} /> : null;
}
export function EventDetails({ event }: { event: ExperimentEvent }) {
  return (
    <div className="experiment-event-detail">
      <Descriptions
        bordered
        column={1}
        size="small"
        items={[
          {
            key: 'project',
            label: '实验',
            children: `${event.projectSnapshot?.projectCode || event.projectId} · ${event.projectSnapshot?.projectName || ''}`,
          },
          {
            key: 'date',
            label: '采样日期（原始采血日期）',
            children: event.collectDate || '—',
          },
          { key: 'time', label: '时间点', children: event.timePoint || '—' },
          {
            key: 'actor',
            label: '操作人员',
            children: event.actorName || String(event.actorId),
          },
          {
            key: 'at',
            label: '核对 / 变更时间（上海）',
            children: shanghaiTime(event.createdAt),
          },
          {
            key: 'result',
            label: '结果',
            children: names[event.result] || event.result,
          },
          {
            key: 'stage',
            label: '核对阶段',
            children: event.stage ? names[event.stage] : '资料管理',
          },
          { key: 'animal', label: '动物号', children: event.animalNo || '—' },
          {
            key: 'scan',
            label: '原始扫描内容',
            children: <span className="preserve-text">{event.scannedContent || '—'}</span>,
          },
          { key: 'message', label: '具体提示', children: humanizeApiMessage(event.message) || '—' },
          {
            key: 'reason',
            label: '更改原因 / 异常备注',
            children: event.reason || event.remark || '—',
          },
          {
            key: 'tubes',
            label: '来源 / 目标管身份',
            children: `${event.sourceTubeId || '—'} / ${event.targetTubeId || '—'}`,
          },
        ]}
      />
      {event.expected && (
        <section>
          <Typography.Title level={5}>当时预期条件与依据</Typography.Title>
          <Snapshot
            value={{
              animalNo: event.expected.animalNo,
              collectDate: event.expected.collectDate,
              timePoint: event.expected.timePoint,
              round: event.expected.round,
            }}
          />
          <PurposeInfo purpose={event.expected.purposeSnapshot} />
          <MappingInfo mapping={event.expected.mappingSnapshot} />
          <TubeInfo tube={event.expected.sourceSnapshot} />
        </section>
      )}
      {event.actual && (
        <section>
          <Typography.Title level={5}>当时实际扫描管子</Typography.Title>
          <TubeInfo tube={event.actual} />
        </section>
      )}
      {(event.before || event.after) && (
        <div className="experiment-snapshot-comparison">
          <section>
            <Typography.Title level={5}>修改前</Typography.Title>
            <Snapshot value={event.before} />
          </section>
          <section>
            <Typography.Title level={5}>修改后</Typography.Title>
            <Snapshot value={event.after} />
          </section>
        </div>
      )}
      <Collapse
        items={[
          {
            key: 'raw',
            label: '展开完整原始归档',
            children: <JsonDetail value={event} />,
          },
        ]}
      />
    </div>
  );
}
