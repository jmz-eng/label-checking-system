import { Button, Form, Input, Modal, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import { createProject, fetchProjects } from '../api/projects';
import { useAuth } from '../stores/AuthContext';
import type { Project } from '../types';
import { formatDateTime } from '../utils/status';

interface ProjectFormValues {
  projectCode: string;
  projectName: string;
  testArticle: string;
  sponsor?: string;
}

export function ProjectsPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<ProjectFormValues>();

  const load = useCallback(async (searchKeyword = '') => {
    setLoading(true);
    try {
      setProjects(await fetchProjects(searchKeyword));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createProject(values);
      message.success('项目创建成功');
      setOpen(false);
      form.resetFields();
      await load(keyword);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目创建失败');
    }
  };

  const columns: ColumnsType<Project> = [
    { title: '项目编号', dataIndex: 'projectCode', width: 160 },
    { title: '项目名称', dataIndex: 'projectName' },
    { title: '供试品', dataIndex: 'testArticle', width: 160 },
    { title: '委托方', dataIndex: 'sponsor', width: 160, render: (value?: string) => value || '-' },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '创建时间', dataIndex: 'createdAt', width: 180, render: formatDateTime },
  ];

  return (
    <div className="content-panel">
      <div className="panel-title-row">
        <div>
          <Typography.Title level={4}>项目管理</Typography.Title>
          <Typography.Text type="secondary">项目编号是标签编码和扫码核对的基础字段</Typography.Text>
        </div>
        <Space>
          <Input.Search
            placeholder="搜索项目编号、名称、供试品"
            allowClear
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => void load(value)}
            style={{ width: 280 }}
          />
          {hasPermission('project:create') && (
            <Button type="primary" onClick={() => setOpen(true)}>
              新增项目
            </Button>
          )}
        </Space>
      </div>
      <Table rowKey="id" columns={columns} dataSource={projects} loading={loading} />

      <Modal
        title="新增项目"
        open={open}
        onOk={() => void handleCreate()}
        onCancel={() => setOpen(false)}
        okText="保存"
        cancelText="取消"
      >
        <Form<ProjectFormValues> form={form} layout="vertical">
          <Form.Item name="projectCode" label="项目编号" rules={[{ required: true, message: '请输入项目编号' }]}>
            <Input placeholder="例如 SN26007PK02" />
          </Form.Item>
          <Form.Item name="projectName" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如 PK 采血项目" />
          </Form.Item>
          <Form.Item name="testArticle" label="供试品" rules={[{ required: true, message: '请输入供试品' }]}>
            <Input placeholder="例如 供试品 A" />
          </Form.Item>
          <Form.Item name="sponsor" label="委托方">
            <Input placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
