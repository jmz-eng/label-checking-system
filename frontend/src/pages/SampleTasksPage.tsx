import { Button, DatePicker, Drawer, Form, Input, Select, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchProjects } from '../api/projects';
import { fetchSampleTasks, generateSampleTasks } from '../api/sampleTasks';
import { LabelPreview } from '../components/LabelPreview';
import { SampleTypeMark } from '../components/SampleTypeMark';
import { StatusTag } from '../components/StatusTag';
import { useAuth } from '../stores/AuthContext';
import type { Project, SampleTask, TaskStatus } from '../types';
import { formatDateTime, taskStatusText } from '../utils/status';

interface TaskFormValues {
  projectId: number;
  animalNo: string;
  groupNo?: string;
  gender?: string;
  sampleType: string;
  timePoint: string;
  plannedCollectDate: dayjs.Dayjs;
  tubeNo?: string;
}

export function SampleTasksPage() {
  const { hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<SampleTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | undefined>();
  const [keyword, setKeyword] = useState('');
  const [previewTask, setPreviewTask] = useState<SampleTask | null>(null);
  const [form] = Form.useForm<TaskFormValues>();

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      setSelectedProjectId((current) => {
        const nextProjectId = current ?? data[0]?.id;
        if (nextProjectId) {
          form.setFieldValue('projectId', nextProjectId);
        }
        return nextProjectId;
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '项目加载失败');
    }
  }, [form]);

  const loadTasks = useCallback(async (
    projectId?: number,
    status?: TaskStatus,
    searchKeyword = '',
  ) => {
    setLoading(true);
    try {
      setTasks(await fetchSampleTasks({ projectId, status, keyword: searchKeyword }));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '采样任务加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    void loadTasks(selectedProjectId, selectedStatus);
  }, [loadTasks, selectedProjectId, selectedStatus]);

  const projectOptions = useMemo(
    () => projects.map((item) => ({ label: `${item.projectCode}｜${item.projectName}`, value: item.id })),
    [projects],
  );

  const handleGenerate = async () => {
    const values = await form.validateFields();
    try {
      await generateSampleTasks({
        projectId: values.projectId,
        rows: [
          {
            animalNo: values.animalNo,
            groupNo: values.groupNo,
            gender: values.gender,
            sampleType: values.sampleType,
            timePoint: values.timePoint,
            plannedCollectDate: values.plannedCollectDate.format('YYYY-MM-DD'),
            tubeNo: values.tubeNo,
          },
        ],
      });
      message.success('采样任务生成成功');
      form.setFieldsValue({
        animalNo: '',
        groupNo: '',
        gender: undefined,
        sampleType: 'PK',
        timePoint: '',
        tubeNo: '',
      });
      setSelectedProjectId(values.projectId);
      await loadTasks(values.projectId, selectedStatus, keyword);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '采样任务生成失败');
    }
  };

  const columns: ColumnsType<SampleTask> = [
    { title: '条形码', dataIndex: 'barcode', ellipsis: true },
    { title: '原标签码', dataIndex: 'labelCode', ellipsis: true },
    { title: '项目号', dataIndex: 'projectCode', width: 140 },
    { title: '动物号', dataIndex: 'animalNo', width: 120 },
    { title: '时间点', dataIndex: 'timePoint', width: 110 },
    { title: '采样类型', dataIndex: 'sampleType', width: 120, render: (value: string) => <SampleTypeMark sampleType={value} /> },
    { title: '采集日期', dataIndex: 'plannedCollectDate', width: 120 },
    { title: '管号', dataIndex: 'tubeNo', width: 90, render: (value?: string) => value || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status: TaskStatus) => <StatusTag status={status} />,
    },
    { title: '创建时间', dataIndex: 'createdAt', width: 170, render: formatDateTime },
    {
      title: '操作',
      width: 110,
      render: (_, record) => (
        <Button type="link" onClick={() => setPreviewTask(record)}>
          标签预览
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} className="page-stack">
      {hasPermission('sample:generate') && (
        <div className="content-panel">
          <div className="panel-title-row">
            <div>
              <Typography.Title level={4}>生成采样任务</Typography.Title>
              <Typography.Text type="secondary">系统自动生成标签码，避免手工敲码</Typography.Text>
            </div>
          </div>
          <Form<TaskFormValues>
            form={form}
            layout="vertical"
            initialValues={{
              sampleType: 'PK',
              plannedCollectDate: dayjs('2026-06-09'),
            }}
          >
            <div className="task-form-grid">
              <Form.Item name="projectId" label="项目" rules={[{ required: true, message: '请选择项目' }]}>
                <Select options={projectOptions} placeholder="请选择项目" onChange={setSelectedProjectId} />
              </Form.Item>
              <Form.Item name="animalNo" label="动物号" rules={[{ required: true, message: '请输入动物号' }]}>
                <Input placeholder="312-11-PK" />
              </Form.Item>
              <Form.Item name="groupNo" label="组别">
                <Input placeholder="312" />
              </Form.Item>
              <Form.Item name="gender" label="性别">
                <Select
                  allowClear
                  options={[
                    { label: '雄性', value: 'M' },
                    { label: '雌性', value: 'F' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="sampleType" label="样本类型" rules={[{ required: true, message: '请输入样本类型' }]}>
                <Input placeholder="PK" />
              </Form.Item>
              <Form.Item name="timePoint" label="时间点" rules={[{ required: true, message: '请输入时间点' }]}>
                <Input placeholder="D1-96h" />
              </Form.Item>
              <Form.Item name="plannedCollectDate" label="采集日期" rules={[{ required: true, message: '请选择采集日期' }]}>
                <DatePicker className="full-width" />
              </Form.Item>
              <Form.Item name="tubeNo" label="管号">
                <Input placeholder="A01" />
              </Form.Item>
            </div>
            <Button type="primary" onClick={() => void handleGenerate()}>
              生成任务与标签码
            </Button>
          </Form>
        </div>
      )}

      <div className="content-panel">
        <div className="panel-title-row">
          <div>
            <Typography.Title level={4}>采样任务</Typography.Title>
            <Typography.Text type="secondary">标签生成后进入贴标绑定和扫码核对流程</Typography.Text>
          </div>
          <Space>
            <Select
              allowClear
              placeholder="全部状态"
              value={selectedStatus}
              onChange={setSelectedStatus}
              style={{ width: 140 }}
              options={Object.entries(taskStatusText).map(([value, label]) => ({ value, label }))}
            />
            <Input.Search
              placeholder="标签码、动物号、时间点"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onSearch={(value) => void loadTasks(selectedProjectId, selectedStatus, value)}
              allowClear
              style={{ width: 260 }}
            />
          </Space>
        </div>
        <Table rowKey="id" columns={columns} dataSource={tasks} loading={loading} scroll={{ x: 1180 }} />
      </div>

      <Drawer
        title="标签预览"
        open={Boolean(previewTask)}
        onClose={() => setPreviewTask(null)}
        width={420}
        extra={<Button onClick={() => window.print()}>打印</Button>}
      >
        {previewTask && <LabelPreview task={previewTask} />}
      </Drawer>
    </Space>
  );
}
