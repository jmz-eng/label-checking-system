import { Col, Progress, Row, Space, Statistic, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { fetchSampleTasks } from '../api/sampleTasks';
import { fetchScanRecords } from '../api/trace';
import { fetchWorkbenchSummary } from '../api/workbench';
import { StatusTag } from '../components/StatusTag';
import type { SampleTask, ScanRecord, TaskStatus, WorkbenchSummary } from '../types';
import { scanActionText } from '../utils/status';

const emptySummary: WorkbenchSummary = {
  totalTasks: 0,
  checkedTasks: 0,
  passedTasks: 0,
  failedRecords: 0,
  pendingTasks: 0,
  traceRecords: 0,
  checkedRate: 0,
  passedRate: 0,
  exceptionRate: 0,
  pendingRate: 0,
};

export function StatisticsReportPage() {
  const [summary, setSummary] = useState<WorkbenchSummary>(emptySummary);
  const [tasks, setTasks] = useState<SampleTask[]>([]);
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [summaryData, taskData, recordData] = await Promise.all([
          fetchWorkbenchSummary(),
          fetchSampleTasks(),
          fetchScanRecords(),
        ]);
        setSummary(summaryData);
        setTasks(taskData);
        setRecords(recordData);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '统计报表加载失败');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const statusRows = useMemo(() => {
    const counts = tasks.reduce<Record<TaskStatus, number>>(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      { PRINTED: 0, BOUND: 0, VERIFIED: 0, RECORDED: 0, VOIDED: 0 },
    );
    return Object.entries(counts).map(([status, count]) => ({ status: status as TaskStatus, count }));
  }, [tasks]);

  const actionRows = useMemo(() => {
    const counts = records.reduce<Record<string, number>>((acc, record) => {
      acc[record.actionType] = (acc[record.actionType] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([actionType, count]) => ({ actionType, count }));
  }, [records]);

  const statusColumns: ColumnsType<{ status: TaskStatus; count: number }> = [
    { title: '任务状态', dataIndex: 'status', render: (status: TaskStatus) => <StatusTag status={status} /> },
    { title: '数量', dataIndex: 'count', width: 120 },
    {
      title: '占比',
      render: (_, record) => <Progress percent={summary.totalTasks ? Number(((record.count / summary.totalTasks) * 100).toFixed(2)) : 0} size="small" />,
    },
  ];

  const actionColumns: ColumnsType<{ actionType: string; count: number }> = [
    { title: '扫码动作', dataIndex: 'actionType', render: (value: string) => scanActionText[value] ?? value },
    { title: '记录数量', dataIndex: 'count', width: 140 },
    {
      title: '占比',
      render: (_, record) => <Progress percent={summary.traceRecords ? Number(((record.count / summary.traceRecords) * 100).toFixed(2)) : 0} size="small" />,
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><div className="metric-panel"><Statistic title="任务总数" value={summary.totalTasks} /></div></Col>
        <Col xs={24} md={6}><div className="metric-panel"><Statistic title="核对通过率" value={summary.passedRate} suffix="%" valueStyle={{ color: '#12a16d' }} /></div></Col>
        <Col xs={24} md={6}><div className="metric-panel"><Statistic title="异常拦截率" value={summary.exceptionRate} suffix="%" valueStyle={{ color: '#e5484d' }} /></div></Col>
        <Col xs={24} md={6}><div className="metric-panel"><Statistic title="追溯记录" value={summary.traceRecords} /></div></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div className="content-panel">
            <Typography.Title level={4}>任务状态分布</Typography.Title>
            <Table rowKey="status" loading={loading} columns={statusColumns} dataSource={statusRows} pagination={false} />
          </div>
        </Col>
        <Col xs={24} lg={12}>
          <div className="content-panel">
            <Typography.Title level={4}>扫码动作分布</Typography.Title>
            <Table rowKey="actionType" loading={loading} columns={actionColumns} dataSource={actionRows} pagination={false} />
          </div>
        </Col>
      </Row>
    </Space>
  );
}
