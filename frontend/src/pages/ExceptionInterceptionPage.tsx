import { Alert, Input, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchScanRecords } from '../api/trace';
import type { ScanRecord } from '../types';
import { formatDateTime, scanActionText } from '../utils/status';

export function ExceptionInterceptionPage() {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      setRecords(await fetchScanRecords(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '异常记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const failedRecords = useMemo(() => records.filter((record) => record.result === 'FAIL'), [records]);
  const missingLabelCount = failedRecords.filter((record) => record.message.includes('不存在')).length;
  const mismatchCount = failedRecords.filter((record) => record.message.includes('不一致')).length;

  const columns: ColumnsType<ScanRecord> = [
    { title: '拦截时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
    { title: '操作类型', dataIndex: 'actionType', width: 120, render: (value: string) => scanActionText[value] ?? value },
    { title: '标签码', dataIndex: 'labelCode', ellipsis: true },
    { title: '实际输入', dataIndex: 'scannedPayload', ellipsis: true },
    { title: '期望信息', dataIndex: 'expectedSummary', ellipsis: true },
    { title: '操作者', dataIndex: 'operatorName', width: 100 },
    { title: '原因', dataIndex: 'message', ellipsis: true },
    { title: '结果', dataIndex: 'result', width: 90, render: () => <Tag color="error">已拦截</Tag> },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      <div className="exception-metrics">
        <div className="metric-panel"><Statistic title="异常拦截" value={failedRecords.length} valueStyle={{ color: '#e5484d' }} /></div>
        <div className="metric-panel"><Statistic title="信息不一致" value={mismatchCount} valueStyle={{ color: '#f59e0b' }} /></div>
        <div className="metric-panel"><Statistic title="标签不存在" value={missingLabelCount} valueStyle={{ color: '#7c3aed' }} /></div>
      </div>

      <Alert
        type={failedRecords.length > 0 ? 'warning' : 'success'}
        showIcon
        message={failedRecords.length > 0 ? '存在需要复核的异常拦截' : '当前无异常拦截'}
        description="异常拦截记录来自扫码绑定、操作核对和录入确认，后端会保留期望信息、实际输入、操作者和原因。"
      />

      <div className="content-panel">
        <div className="panel-title-row">
          <div>
            <Typography.Title level={4}>异常拦截</Typography.Title>
            <Typography.Text type="secondary">只展示扫码失败或核对不一致的记录</Typography.Text>
          </div>
          <Input.Search
            placeholder="标签码关键字"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => void load(value)}
            allowClear
            style={{ width: 260 }}
          />
        </div>
        <Table rowKey="id" columns={columns} dataSource={failedRecords} loading={loading} scroll={{ x: 1180 }} />
      </div>
    </Space>
  );
}
