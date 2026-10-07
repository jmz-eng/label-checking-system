import { Alert, Button, Empty, Input, Space, Table, Typography, message } from 'antd';
import { createPortal } from 'react-dom';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSampleTasks } from '../api/sampleTasks';
import { LabelPreview } from '../components/LabelPreview';
import { SampleTypeMark } from '../components/SampleTypeMark';
import { StatusTag } from '../components/StatusTag';
import type { SampleTask, TaskStatus } from '../types';
import { formatDateTime } from '../utils/status';
import { createLabelLayout } from '../utils/labelLayout';

export function LabelPreviewPage() {
  const [tasks, setTasks] = useState<SampleTask[]>([]);
  const [keyword, setKeyword] = useState('');
  const [selectedTask, setSelectedTask] = useState<SampleTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const latestRequest = useRef(0);
  const selectedLayout = useMemo(() => selectedTask ? createLabelLayout(selectedTask) : null, [selectedTask]);
  const canPrint = !!selectedTask && !selectedLayout?.error && !loading && !loadFailed;

  const load = useCallback(async (searchKeyword = '') => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await fetchSampleTasks({ keyword: searchKeyword });
      if (requestId !== latestRequest.current) return;
      setTasks(data);
      setSelectedTask((current) => data.find((task) => task.id === current?.id) ?? data[0] ?? null);
    } catch (error) {
      if (requestId !== latestRequest.current) return;
      setLoadFailed(true);
      setTasks([]);
      setSelectedTask(null);
      message.error(error instanceof Error ? error.message : '标签数据加载失败');
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const labelGrid = useMemo(() => tasks.slice(0, 6), [tasks]);

  const columns: ColumnsType<SampleTask> = [
    { title: '条形码', dataIndex: 'barcode', ellipsis: true },
    { title: '原标签码', dataIndex: 'labelCode', ellipsis: true },
    { title: '项目号', dataIndex: 'projectCode', width: 140 },
    { title: '动物号', dataIndex: 'animalNo', width: 120 },
    { title: '样本类型', dataIndex: 'sampleType', width: 120, render: (value: string) => <SampleTypeMark sampleType={value} /> },
    { title: '时间点', dataIndex: 'timePoint', width: 110 },
    { title: '采集日期', dataIndex: 'plannedCollectDate', width: 120 },
    { title: '状态', dataIndex: 'status', width: 100, render: (status: TaskStatus) => <StatusTag status={status} /> },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
  ];

  return (
    <div className="label-module-layout">
      <Space direction="vertical" size={14} className="page-stack">
        <div className="content-panel">
          <div className="panel-title-row">
            <div>
              <Typography.Title level={4}>标签预览</Typography.Title>
              <Typography.Text type="secondary">25 × 10 mm · 300 dpi · CODE128 C · 持久化12位条形码</Typography.Text>
            </div>
            <Space>
              <Input.Search
                placeholder="标签码、动物号、项目号"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onSearch={(value) => void load(value)}
                allowClear
                style={{ width: 260 }}
              />
              <Button disabled={!canPrint} onClick={() => { if (canPrint) window.print(); }}>打印当前标签</Button>
            </Space>
          </div>
          <Alert className="label-print-help" type="info" showIcon message="打印设置"
            description="纸张宽 25 mm、高 10 mm，缩放 100%（实际大小），边距设为无，关闭页眉页脚。屏幕预览已放大，打印时只输出右侧当前标签一张。" />
          <div className="label-card-grid">
            {labelGrid.map((task) => (
              <button className="label-card-button" aria-pressed={selectedTask?.id === task.id} key={task.id} onClick={() => setSelectedTask(task)}>
                <LabelPreview task={task} />
              </button>
            ))}
            {labelGrid.length === 0 && <Empty description="暂无标签" />}
          </div>
        </div>

        <div className="content-panel">
          <Table
            rowKey="id"
            columns={columns}
            dataSource={tasks}
            loading={loading}
            scroll={{ x: 1100 }}
            onRow={(record) => ({ onClick: () => setSelectedTask(record) })}
          />
        </div>
      </Space>

      <div className="content-panel sticky-preview">
        <Typography.Title level={4}>当前标签</Typography.Title>
        {selectedTask ? <LabelPreview task={selectedTask} /> : <Empty description="请选择标签" />}
      </div>
      {canPrint && selectedTask && createPortal(
        <div id="label-print-root" aria-hidden="true"><LabelPreview task={selectedTask} /></div>, document.body,
      )}
    </div>
  );
}
