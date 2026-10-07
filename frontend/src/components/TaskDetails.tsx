import { Descriptions, Drawer, Empty, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { SampleTask, ScanRecord } from '../types';
import { formatDateTime, scanActionText } from '../utils/status';
import { LabelPreview } from './LabelPreview';
import { StatusTag } from './StatusTag';

interface TaskDetailsProps {
  task: SampleTask | null;
  records: ScanRecord[];
  canViewRecords: boolean;
  recordsError?: string;
  onClose: () => void;
}

const columns: ColumnsType<ScanRecord> = [
  { title: '时间', dataIndex: 'createdAt', render: formatDateTime, width: 170 },
  { title: '操作', dataIndex: 'actionType', render: (value: string) => scanActionText[value] ?? value, width: 110 },
  { title: '操作人', dataIndex: 'operatorName', width: 100 },
  { title: '结果', dataIndex: 'result', width: 80, render: (value: string) => <Tag color={value === 'PASS' ? 'success' : 'error'}>{value === 'PASS' ? '通过' : '拦截'}</Tag> },
  { title: '说明', dataIndex: 'message' },
];

export function TaskDetails({ task, records, canViewRecords, recordsError, onClose }: TaskDetailsProps) {
  return (
    <Drawer title="采样任务详情" open={Boolean(task)} onClose={onClose} width={760}>
      {task ? (
        <>
          <Descriptions bordered column={1} size="small" items={[
            { key: 'barcode', label: '条形码', children: task.barcode || '未登记' },
            { key: 'label', label: '原标签码', children: task.labelCode },
            { key: 'project', label: '项目', children: `${task.projectCode} / ${task.projectName}` },
            { key: 'animal', label: '动物号', children: task.animalNo },
            { key: 'sample', label: '样本类型', children: task.sampleType },
            { key: 'point', label: '时间点', children: task.timePoint },
            { key: 'date', label: '计划采集日期', children: task.plannedCollectDate },
            { key: 'tube', label: '试管号', children: task.tubeNo || '-' },
            { key: 'status', label: '当前状态', children: <StatusTag status={task.status} /> },
            { key: 'created', label: '创建时间', children: formatDateTime(task.createdAt) },
          ]} />
          <Typography.Title level={5}>标签预览</Typography.Title>
          <LabelPreview task={task} />
          <Typography.Title level={5}>该任务的扫码记录</Typography.Title>
          {canViewRecords && !recordsError ? (
            <Table rowKey="id" columns={columns} dataSource={records.filter((record) => record.labelCode === task.labelCode)} size="small" scroll={{ x: 680 }} pagination={{ pageSize: 5 }} />
          ) : <Typography.Text type="secondary">{recordsError || '当前账号无扫码记录查看权限'}</Typography.Text>}
        </>
      ) : <Empty description="请选择任务" />}
    </Drawer>
  );
}
