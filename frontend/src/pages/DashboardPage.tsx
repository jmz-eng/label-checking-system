import {
  Alert,
  Button,
  Col,
  DatePicker,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { InputRef } from 'antd';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifySample } from '../api/sampleTasks';
import { fetchSampleTasks } from '../api/sampleTasks';
import { fetchScanRecords } from '../api/trace';
import { fetchWorkbenchSummary } from '../api/workbench';
import { LabelPreview } from '../components/LabelPreview';
import { SampleTypeMark } from '../components/SampleTypeMark';
import { StatusTag } from '../components/StatusTag';
import { TaskDetails } from '../components/TaskDetails';
import { useAuth } from '../stores/AuthContext';
import type { AppMenu, SampleTask, ScanRecord, ScanResult, TaskStatus, WorkbenchSummary } from '../types';
import { formatDateTime, scanActionText, taskStatusText } from '../utils/status';

interface QuickVerifyValues {
  labelCode: string;
}

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

function taskNo(task: SampleTask): string {
  return `TK${task.plannedCollectDate.replace(/-/g, '')}${String(task.id).padStart(4, '0')}`;
}

function findRoute(menus: AppMenu[], component: string): string | undefined {
  for (const menu of menus) {
    if (menu.component === component && menu.routePath) return menu.routePath;
    const route = findRoute(menu.children ?? [], component);
    if (route) return route;
  }
  return undefined;
}

export function DashboardPage() {
  const { hasPermission, menus } = useAuth();
  const navigate = useNavigate();
  const canViewTasks = hasPermission('sample:view');
  const canViewRecords = hasPermission('record:view');
  const canVerify = hasPermission('sample:verify') && canViewTasks;
  const traceRoute = findRoute(menus, 'TracePage');
  const inputRef = useRef<InputRef>(null);
  const scanCardRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const [tasks, setTasks] = useState<SampleTask[]>([]);
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [summary, setSummary] = useState<WorkbenchSummary>(emptySummary);
  const [activeTask, setActiveTask] = useState<SampleTask | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<TaskStatus>();
  const [sampleType, setSampleType] = useState<string>();
  const [collectDate, setCollectDate] = useState<string>();
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [recordsError, setRecordsError] = useState('');
  const [summaryAvailable, setSummaryAvailable] = useState(false);
  const [form] = Form.useForm<QuickVerifyValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResult, taskResult, recordResult] = await Promise.allSettled([
        fetchWorkbenchSummary(),
        canViewTasks ? fetchSampleTasks() : Promise.resolve([] as SampleTask[]),
        canViewRecords ? fetchScanRecords() : Promise.resolve([] as ScanRecord[]),
      ]);
      const errors: string[] = [];
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value);
      else errors.push('统计数据加载失败');
      setSummaryAvailable(summaryResult.status === 'fulfilled');
      const taskData = taskResult.status === 'fulfilled' ? taskResult.value : [];
      if (taskResult.status === 'rejected') errors.push('采样任务加载失败');
      if (recordResult.status === 'rejected') errors.push('扫码记录加载失败');
      setRecordsError(recordResult.status === 'rejected' ? '扫码记录加载失败，请重试' : '');
      setTasks(taskData);
      setRecords(recordResult.status === 'fulfilled' ? recordResult.value : []);
      setActiveTask((current) => taskData.find((task) => task.id === current?.id) ?? taskData[0] ?? null);
      setLoadErrors(errors);
    } finally {
      setLoading(false);
    }
  }, [canViewTasks, canViewRecords]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredTasks = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    return tasks.filter((task) => (!status || task.status === status)
      && (!sampleType || task.sampleType === sampleType)
      && (!collectDate || task.plannedCollectDate === collectDate)
      && (!query || [task.labelCode, task.animalNo, task.projectCode, task.timePoint, taskNo(task)]
        .some((value) => value.toLowerCase().includes(query))));
  }, [tasks, status, sampleType, collectDate, keyword]);
  const latestRecords = records.slice(0, 4);
  const latestVerification = records.find((record) => record.labelCode === activeTask?.labelCode
    && record.actionType === 'VERIFY' && record.result === 'PASS');

  const exceptionMessage = useMemo(() => {
    const failed = records.find((record) => record.result === 'FAIL');
    if (!canViewRecords) return '当前账号无扫码记录查看权限';
    return recordsError || failed?.message || '暂无异常拦截记录';
  }, [records, canViewRecords, recordsError]);

  const handleSelectTask = (task: SampleTask) => {
    if (submittingRef.current) return;
    setActiveTask(task);
    form.resetFields();
    setScanResult(null);
  };

  const handleQuickVerify = async (values: QuickVerifyValues) => {
    if (!canVerify || submittingRef.current) return;
    // 使用独立选中的任务作为核对依据，不能用扫描结果反查自身并自动判为一致。
    const task = activeTask;
    if (!task) {
      message.warning('请先选择一条采样任务');
      return;
    }
    if (task.status !== 'BOUND') {
      message.warning('请选择已完成贴标绑定的待核对任务');
      return;
    }
    submittingRef.current = true;
    setVerifying(true);
    setScanResult(null);
    try {
      const result = await verifySample({
        labelCode: values.labelCode.trim(),
        projectCode: task.projectCode,
        animalNo: task.animalNo,
        timePoint: task.timePoint,
      });
      setScanResult(result);
      if (result.passed) message.success(result.message);
      else message.warning(result.message);
      await load();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '扫码核对失败');
    } finally {
      submittingRef.current = false;
      setVerifying(false);
    }
  };

  const columns: ColumnsType<SampleTask> = [
    {
      title: '任务号',
      width: 150,
      render: (_, record) => (
        <Button type="link" onClick={(event) => { event.stopPropagation(); setDetailTaskId(record.id); }}>
          {taskNo(record)}
        </Button>
      ),
    },
    { title: '计划采集日期', dataIndex: 'plannedCollectDate', width: 130 },
    {
      title: '动物号 / 项目号',
      width: 170,
      render: (_, record) => `${record.animalNo} / ${record.projectCode}`,
    },
    {
      title: '标本类型',
      width: 130,
      render: (_, record) => <SampleTypeMark sampleType={record.sampleType} />,
    },
    {
      title: '当前状态',
      dataIndex: 'status',
      width: 110,
      render: (status: TaskStatus) => <StatusTag status={status} />,
    },
    {
      title: '核对人',
      width: 90,
      render: (_, task) => records.find((record) => record.labelCode === task.labelCode
        && record.actionType === 'VERIFY' && record.result === 'PASS')?.operatorName ?? '-',
    },
    {
      title: '操作',
      width: 130,
      fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" onClick={(event) => { event.stopPropagation(); setDetailTaskId(record.id); }}>查看</Button>
          {canVerify && record.status === 'BOUND' && (
            <Button type="link" disabled={verifying} onClick={(event) => {
              event.stopPropagation();
              handleSelectTask(record);
              scanCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              inputRef.current?.focus();
            }}>核对</Button>
          )}
        </Space>
      ),
    },
  ];

  const recordColumns: ColumnsType<ScanRecord> = [
    { title: '记录时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
    { title: '操作类型', dataIndex: 'actionType', width: 110, render: (value: string) => scanActionText[value] ?? value },
    { title: '任务号', width: 150, render: (_, record) => record.labelCode.slice(-18) },
    { title: '样本条码', dataIndex: 'labelCode', ellipsis: true },
    { title: '操作者', dataIndex: 'operatorName', width: 90 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 90,
      render: (value: string) => <Tag color={value === 'PASS' ? 'success' : 'error'}>{value === 'PASS' ? '通过' : '拦截'}</Tag>,
    },
    { title: '备注', dataIndex: 'message', ellipsis: true },
  ];

  return (
    <Space direction="vertical" size={14} className="workbench-page">
      {loadErrors.length > 0 && <Alert type="error" showIcon message={loadErrors.join('；')} action={<Button onClick={() => void load()} loading={loading}>重试</Button>} />}
      <div className="metric-strip">
        <div className="metric-item metric-item-primary">
          <Statistic title="累计任务" value={summaryAvailable ? summary.totalTasks : '-'} valueStyle={{ color: '#2563eb' }} />
          <span className="metric-subtext">全部日期</span>
        </div>
        <div className="metric-item metric-item-success">
          <Statistic title="核对次数" value={summaryAvailable ? summary.checkedTasks : '-'} valueStyle={{ color: '#0f9f6e' }} />
          <span className="metric-subtext">包含重复核对</span>
        </div>
        <div className="metric-item metric-item-success">
          <Statistic title="通过次数" value={summaryAvailable ? summary.passedTasks : '-'} valueStyle={{ color: '#12a16d' }} />
          <span className="metric-subtext">核对通过记录</span>
        </div>
        <div className="metric-item metric-item-danger">
          <Statistic title="异常拦截" value={summaryAvailable ? summary.failedRecords : '-'} valueStyle={{ color: '#e5484d' }} />
          <span className="metric-subtext">全部扫码失败记录</span>
        </div>
        <div className="metric-item metric-item-warning">
          <Statistic title="待处理" value={summaryAvailable ? summary.pendingTasks : '-'} valueStyle={{ color: '#f59e0b' }} />
          <span className="metric-subtext">待贴标及待核对</span>
        </div>
        <div className="metric-item metric-item-info">
          <Statistic title="追溯记录" value={summaryAvailable ? summary.traceRecords : '-'} valueStyle={{ color: '#1f3f8f' }} />
          <span className="metric-subtext">全部日期</span>
        </div>
        <div className="metric-date-cell">
          <span className="metric-date-label">任务采集日期</span>
          <DatePicker className="workbench-date" aria-label="任务采集日期" placeholder="全部日期" onChange={(date) => setCollectDate(date?.format('YYYY-MM-DD'))} />
        </div>
      </div>

      <Row gutter={[14, 14]} align="top">
        <Col xs={24} xl={16}>
          <Space direction="vertical" size={14} className="page-stack">
            <div className="content-panel workbench-task-panel">
              <div className="panel-title-row">
                <Typography.Title level={4}>采样任务</Typography.Title>
                <Space wrap>
                  <Select aria-label="任务状态" placeholder="全部状态" allowClear value={status} onChange={setStatus} style={{ width: 120 }} options={Object.entries(taskStatusText).map(([value, label]) => ({ value, label }))} />
                  <Select aria-label="样本类型" placeholder="样本类型" allowClear value={sampleType} onChange={setSampleType} style={{ width: 130 }} options={[...new Set(tasks.map((task) => task.sampleType))].map((value) => ({ value, label: value }))} />
                  <Input.Search placeholder="条码 / 动物号 / 项目号" allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 230 }} />
                </Space>
              </div>
              <Table
                rowKey="id"
                loading={loading}
                columns={columns}
                dataSource={filteredTasks}
                locale={{ emptyText: canViewTasks ? '暂无符合条件的采样任务' : '当前账号无采样任务查看权限' }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                size="middle"
                scroll={{ x: 1080 }}
                rowClassName={(record) => (record.id === activeTask?.id ? 'selected-row' : '')}
                onRow={(record) => ({ onClick: () => handleSelectTask(record) })}
              />
            </div>

            <div className="content-panel">
              <div className="panel-title-row compact">
                <Typography.Title level={4}>追溯记录</Typography.Title>
                {canViewRecords && traceRoute && <Button type="link" onClick={() => navigate(traceRoute)}>更多记录</Button>}
              </div>
              <Table
                rowKey="id"
                columns={recordColumns}
                dataSource={latestRecords}
                loading={loading}
                locale={{ emptyText: recordsError || (canViewRecords ? '暂无扫码记录' : '当前账号无扫码记录查看权限') }}
                pagination={false}
                size="small"
                scroll={{ x: 940 }}
              />
            </div>
          </Space>
        </Col>

        <Col xs={24} xl={8}>
          <Space direction="vertical" size={14} className="page-stack">
            <div className="content-panel scan-card" ref={scanCardRef}>
              <div className="panel-title-row compact">
                <Typography.Title level={4}>扫码核对</Typography.Title>
                {canVerify && <Button type="link" onClick={() => inputRef.current?.focus()}>手动输入</Button>}
              </div>
              <Form<QuickVerifyValues> form={form} layout="vertical" onFinish={(values) => void handleQuickVerify(values)}>
                <Form.Item name="labelCode" label="扫描输入" rules={[{ required: true, whitespace: true, message: '请扫描标签码' }]}>
                  <Input ref={inputRef} disabled={!canVerify || verifying} placeholder="请扫描样本条码或标签条码" onChange={() => setScanResult(null)} />
                </Form.Item>
                <Typography.Text strong>核对结果</Typography.Text>
                <Alert className="workbench-scan-feedback" showIcon
                  type={scanResult ? (scanResult.passed ? 'success' : 'error') : 'info'}
                  message={scanResult ? (scanResult.passed ? '核对通过' : '异常拦截') : '等待扫码核对'}
                  description={scanResult?.message ?? (canVerify ? '先选择待核对任务，再扫描实际标签进行比对。' : '当前账号无扫码核对权限。')} />
                {activeTask && (
                  <div className="scan-result-grid">
                    <span>任务号</span><strong>{taskNo(activeTask)}</strong>
                    <span>动物号</span><strong>{activeTask.animalNo}</strong>
                    <span>项目号</span><strong>{activeTask.projectCode}</strong>
                    <span>时间点</span><strong>{activeTask.timePoint}</strong>
                    <span>标本类型</span><strong>{activeTask.sampleType}</strong>
                    <span>计划采集</span><strong>{activeTask.plannedCollectDate}</strong>
                    <span>当前状态</span><StatusTag status={activeTask.status} />
                    <span>最近核对人</span><strong>{latestVerification?.operatorName ?? '-'}</strong>
                    <span>核对时间</span><strong>{formatDateTime(latestVerification?.createdAt)}</strong>
                  </div>
                )}
                <Space className="scan-actions">
                  <Button disabled={!canVerify || verifying} onClick={() => { form.resetFields(); setScanResult(null); inputRef.current?.focus(); }}>重新扫描</Button>
                  {canVerify && <Button type="primary" htmlType="submit" loading={verifying} disabled={!activeTask || activeTask.status !== 'BOUND' || loading}>提交核对</Button>}
                </Space>
              </Form>
            </div>

            <div className="content-panel">
              <div className="panel-title-row compact">
                <Typography.Title level={4}>标签预览</Typography.Title>
                <Button type="link" disabled={!activeTask} onClick={() => setPreviewOpen(true)}>查看大图</Button>
              </div>
              {activeTask ? (
                <LabelPreview task={activeTask} />
              ) : (
                <Typography.Text type="secondary">请选择一条任务查看标签。</Typography.Text>
              )}
            </div>

            <div className="content-panel exception-note">
              <Typography.Text type="secondary">备注</Typography.Text>
              <Typography.Text>{exceptionMessage}</Typography.Text>
            </div>
          </Space>
        </Col>
      </Row>
      <TaskDetails task={tasks.find((task) => task.id === detailTaskId) ?? null} records={records} canViewRecords={canViewRecords} recordsError={recordsError} onClose={() => setDetailTaskId(null)} />
      <Modal title="标签大图" open={previewOpen} onCancel={() => setPreviewOpen(false)} footer={null} width={640}>
        {activeTask && <div className="workbench-label-large"><LabelPreview task={activeTask} /></div>}
      </Modal>
    </Space>
  );
}
