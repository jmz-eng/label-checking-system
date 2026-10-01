import { Input, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { fetchSystemLogs } from '../api/system';
import type { AuditLog } from '../types';
import { formatDateTime } from '../utils/status';

export function LogManagementPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      setLogs(await fetchSystemLogs(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '日志加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnsType<AuditLog> = [
    { title: '模块', dataIndex: 'module', width: 120 },
    { title: '操作', dataIndex: 'operation', width: 140 },
    { title: '业务对象', dataIndex: 'businessKey', width: 180, ellipsis: true },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
    { title: '操作人', dataIndex: 'operatorName', width: 120 },
    { title: '时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>日志管理</Typography.Title>
          <Typography.Text type="secondary">查看登录、菜单、权限、公告和扫码等关键操作日志</Typography.Text>
        </div>
        <Input.Search
          placeholder="按模块、操作、业务对象搜索"
          allowClear
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={(value) => void load(value)}
          style={{ width: 320 }}
        />
      </div>
      <Table rowKey="id" columns={columns} dataSource={logs} loading={loading} scroll={{ x: 980 }} />
    </div>
  );
}
