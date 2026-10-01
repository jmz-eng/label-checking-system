import { Alert, Button, Form, Input, Space, Tabs, Typography, message } from 'antd';
import type { TabsProps } from 'antd';
import { useState } from 'react';
import { bindSample, recordSample, verifySample } from '../api/sampleTasks';
import { LabelPreview } from '../components/LabelPreview';
import { StatusTag } from '../components/StatusTag';
import { useAuth } from '../stores/AuthContext';
import type { ScanResult } from '../types';

interface BindValues {
  labelCode: string;
  animalNo: string;
}

interface VerifyValues {
  labelCode: string;
  projectCode: string;
  animalNo: string;
  timePoint: string;
}

interface RecordValues {
  labelCode: string;
  resultNote?: string;
}

export function ScanWorkbenchPage() {
  const { hasPermission } = useAuth();
  const [result, setResult] = useState<ScanResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const runScan = async <T,>(handler: (values: T) => Promise<ScanResult>, values: T) => {
    setSubmitting(true);
    try {
      const data = await handler(values);
      setResult(data);
      if (data.passed) {
        message.success(data.message);
      } else {
        message.warning(data.message);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '扫码处理失败');
    } finally {
      setSubmitting(false);
    }
  };

  const items: TabsProps['items'] = [
    hasPermission('sample:bind') && {
      key: 'bind',
      label: '贴标绑定',
      children: (
        <Form<BindValues> layout="vertical" onFinish={(values) => void runScan(bindSample, values)}>
          <Form.Item name="labelCode" label="标签码" rules={[{ required: true, message: '请扫描标签码' }]}>
            <Input autoFocus placeholder="扫描或输入标签码" />
          </Form.Item>
          <Form.Item name="animalNo" label="动物号" rules={[{ required: true, message: '请输入动物号' }]}>
            <Input placeholder="312-11-PK" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            提交绑定
          </Button>
        </Form>
      ),
    },
    hasPermission('sample:verify') && {
      key: 'verify',
      label: '操作核对',
      children: (
        <Form<VerifyValues> layout="vertical" onFinish={(values) => void runScan(verifySample, values)}>
          <Form.Item name="labelCode" label="标签码" rules={[{ required: true, message: '请扫描标签码' }]}>
            <Input autoFocus placeholder="扫描或输入标签码" />
          </Form.Item>
          <Form.Item name="projectCode" label="项目号" rules={[{ required: true, message: '请输入项目号' }]}>
            <Input placeholder="SN26007PK02" />
          </Form.Item>
          <Form.Item name="animalNo" label="动物号" rules={[{ required: true, message: '请输入动物号' }]}>
            <Input placeholder="312-11-PK" />
          </Form.Item>
          <Form.Item name="timePoint" label="时间点" rules={[{ required: true, message: '请输入时间点' }]}>
            <Input placeholder="D1-96h" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            执行核对
          </Button>
        </Form>
      ),
    },
    hasPermission('sample:record') && {
      key: 'record',
      label: '录入确认',
      children: (
        <Form<RecordValues> layout="vertical" onFinish={(values) => void runScan(recordSample, values)}>
          <Form.Item name="labelCode" label="标签码" rules={[{ required: true, message: '请扫描标签码' }]}>
            <Input autoFocus placeholder="扫描或输入标签码" />
          </Form.Item>
          <Form.Item name="resultNote" label="录入备注">
            <Input.TextArea rows={4} placeholder="例如 分析端已接收" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            确认录入
          </Button>
        </Form>
      ),
    },
  ].filter(Boolean) as TabsProps['items'];

  return (
    <div className="scan-layout">
      <div className="content-panel">
        <div className="panel-title-row">
          <div>
            <Typography.Title level={4}>扫码核对工作台</Typography.Title>
            <Typography.Text type="secondary">扫码枪输入等同键盘输入，扫完后按回车即可提交</Typography.Text>
          </div>
        </div>
        <Tabs items={items} />
      </div>

      <Space direction="vertical" size={16} className="scan-side">
        <div className="content-panel">
          <Typography.Title level={4}>核对结果</Typography.Title>
          {result ? (
            <Alert
              type={result.passed ? 'success' : 'error'}
              showIcon
              message={result.passed ? '核对通过' : '异常拦截'}
              description={result.message}
            />
          ) : (
            <Alert type="info" showIcon message="等待扫码" description="提交后会显示系统比对结果。" />
          )}
          {result?.task && (
            <div className="result-task">
              <div>
                <span>当前状态</span>
                <StatusTag status={result.task.status} />
              </div>
              <div>
                <span>标签码</span>
                <strong>{result.task.labelCode}</strong>
              </div>
              <div>
                <span>动物号</span>
                <strong>{result.task.animalNo}</strong>
              </div>
              <div>
                <span>时间点</span>
                <strong>{result.task.timePoint}</strong>
              </div>
            </div>
          )}
        </div>
        {result?.task && (
          <div className="content-panel">
            <Typography.Title level={4}>标签预览</Typography.Title>
            <LabelPreview task={result.task} />
          </div>
        )}
      </Space>
    </div>
  );
}

