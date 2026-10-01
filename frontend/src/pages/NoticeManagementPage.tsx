import { Button, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { createNotice, fetchNotices, publishNotice, updateNotice } from '../api/system';
import type { NoticeSavePayload } from '../api/system';
import type { Notice } from '../types';
import { formatDateTime } from '../utils/status';

export function NoticeManagementPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [form] = Form.useForm<NoticeSavePayload>();

  const load = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      setNotices(await fetchNotices(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '公告加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleOpen = (notice?: Notice) => {
    setEditing(notice ?? null);
    form.setFieldsValue(
      notice
        ? {
            title: notice.title,
            content: notice.content,
            noticeType: notice.noticeType,
            publishStatus: notice.publishStatus,
          }
        : {
            noticeType: 'INFO',
            publishStatus: 'DRAFT',
          },
    );
    setOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await updateNotice(editing.id, values);
        message.success('公告已更新');
      } else {
        await createNotice(values);
        message.success('公告已新增');
      }
      setOpen(false);
      await load(keyword);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存公告失败');
    }
  };

  const handlePublish = async (notice: Notice) => {
    try {
      await publishNotice(notice.id);
      message.success('公告已发布');
      await load(keyword);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布公告失败');
    }
  };

  const columns: ColumnsType<Notice> = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    {
      title: '类型',
      dataIndex: 'noticeType',
      width: 100,
      render: (value: Notice['noticeType']) => {
        const color = value === 'WARNING' ? 'warning' : value === 'SUCCESS' ? 'success' : 'processing';
        return <Tag color={color}>{value}</Tag>;
      },
    },
    {
      title: '状态',
      dataIndex: 'publishStatus',
      width: 100,
      render: (value: Notice['publishStatus']) => (
        <Tag color={value === 'PUBLISHED' ? 'success' : 'default'}>{value === 'PUBLISHED' ? '已发布' : '草稿'}</Tag>
      ),
    },
    { title: '创建人', dataIndex: 'creatorName', width: 110 },
    { title: '发布时间', dataIndex: 'publishedAt', width: 180, render: formatDateTime },
    {
      title: '操作',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => handleOpen(record)}>
            编辑
          </Button>
          {record.publishStatus !== 'PUBLISHED' && (
            <Button type="link" onClick={() => void handlePublish(record)}>
              发布
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>公告管理</Typography.Title>
          <Typography.Text type="secondary">维护系统公告，发布后在工作台展示给已登录用户</Typography.Text>
        </div>
        <Space>
          <Input.Search
            placeholder="搜索公告标题或内容"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => void load(value)}
            style={{ width: 260 }}
          />
          <Button type="primary" onClick={() => handleOpen()}>
            新增公告
          </Button>
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={notices} loading={loading} />

      <Modal
        title={editing ? '编辑公告' : '新增公告'}
        open={open}
        onOk={() => void handleSubmit()}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
        width={720}
      >
        <Form<NoticeSavePayload> form={form} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="noticeType" label="公告类型">
            <Select
              options={[
                { label: '普通', value: 'INFO' },
                { label: '警示', value: 'WARNING' },
                { label: '成功', value: 'SUCCESS' },
              ]}
            />
          </Form.Item>
          <Form.Item name="publishStatus" label="发布状态">
            <Select
              options={[
                { label: '草稿', value: 'DRAFT' },
                { label: '发布', value: 'PUBLISHED' },
              ]}
            />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
