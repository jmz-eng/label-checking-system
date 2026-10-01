import { Input, Space, Table, Tabs, Tag, Typography, message } from 'antd';
import type { TabsProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAuditLogs, fetchScanRecords } from '../api/trace';
import { useAuth } from '../stores/AuthContext';
import type { AuditLog, ScanRecord } from '../types';
import { formatDateTime, scanActionText } from '../utils/status';

export function TracePage() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeKey, setActiveKey] = useState(searchParams.get('tab') === 'audit' ? 'audit' : 'records');
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [recordKeyword, setRecordKeyword] = useState('');
  const [auditKeyword, setAuditKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const loadRecords = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      setRecords(await fetchScanRecords(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '扫码记录加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async (searchKeyword = '') => {
    if (!hasPermission('audit:view')) return;
    setLoading(true);
    try {
      setLogs(await fetchAuditLogs(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '审计日志加载失败');
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    if (activeKey === 'audit') {
      void loadLogs();
    }
  }, [activeKey, loadLogs]);

  const recordColumns: ColumnsType<ScanRecord> = [
    { title: '标签码', dataIndex: 'labelCode', ellipsis: true },
    {
      title: '动作',
      dataIndex: 'actionType',
      width: 110,
      render: (value: string) => scanActionText[value] ?? value,
    },
    {
      title: '结果',
      dataIndex: 'result',
      width: 90,
      render: (value: ScanRecord['result']) => (
        <Tag color={value === 'PASS' ? 'success' : 'error'}>{value === 'PASS' ? '通过' : '失败'}</Tag>
      ),
    },
    { title: '说明', dataIndex: 'message', ellipsis: true },
    { title: '操作人', dataIndex: 'operatorName', width: 110 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
  ];

  const auditColumns: ColumnsType<AuditLog> = [
    { title: '模块', dataIndex: 'module', width: 110 },
    { title: '操作', dataIndex: 'operation', width: 120 },
    { title: '业务对象', dataIndex: 'businessKey', width: 180, ellipsis: true },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
    { title: '操作人', dataIndex: 'operatorName', width: 110 },
    { title: '时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
  ];

  const tabItems: TabsProps['items'] = [
    {
      key: 'records',
      label: '扫码记录',
      children: (
        <Space direction="vertical" size={12} className="page-stack">
          <Input.Search
            placeholder="按标签码搜索"
            allowClear
            value={recordKeyword}
            onChange={(event) => setRecordKeyword(event.target.value)}
            onSearch={(value) => void loadRecords(value)}
            style={{ width: 300 }}
          />
          <Table rowKey="id" columns={recordColumns} dataSource={records} loading={loading} scroll={{ x: 980 }} />
        </Space>
      ),
    },
  ];

  if (hasPermission('audit:view')) {
    tabItems.push({
      key: 'audit',
      label: '审计日志',
      children: (
        <Space direction="vertical" size={12} className="page-stack">
          <Input.Search
            placeholder="按模块、操作、业务对象搜索"
            allowClear
            value={auditKeyword}
            onChange={(event) => setAuditKeyword(event.target.value)}
            onSearch={(value) => void loadLogs(value)}
            style={{ width: 320 }}
          />
          <Table rowKey="id" columns={auditColumns} dataSource={logs} loading={loading} scroll={{ x: 980 }} />
        </Space>
      ),
    });
  }

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>追溯记录</Typography.Title>
          <Typography.Text type="secondary">用于异常回溯、监管核查和客户审计</Typography.Text>
        </div>
      </div>
      <Tabs
        activeKey={activeKey}
        onChange={(key) => {
          setActiveKey(key);
          setSearchParams(key === 'audit' ? { tab: 'audit' } : {});
        }}
        items={tabItems}
      />
    </div>
  );
}
