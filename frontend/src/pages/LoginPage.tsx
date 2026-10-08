import { BarcodeOutlined, FileSearchOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/AuthContext';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      await login(values.username, values.password);
      navigate('/', { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page refined-login">
      <div className="login-layout">
        <section className="login-story" aria-label="标签核对系统介绍">
          <div className="login-product-brand">
            <div className="brand-mark">
              <img src="/favicon.svg" alt="" aria-hidden="true" />
            </div>
            <span>标签核对系统</span>
          </div>
          <div className="login-story-content">
            <span className="login-eyebrow">采血样品核对与追溯</span>
            <h1>每一次核对，<br />都有据可查。</h1>
            <p>从动物芯片到采血管，再到分装管，<br />让样品信息准确对应，让操作记录完整保留。</p>
            <ol className="login-workflow">
              <li>
                <span className="login-workflow-icon"><SafetyCertificateOutlined aria-hidden="true" /></span>
                <div><strong>采血核对</strong><span>动物芯片与采血管对应</span></div>
                <span className="login-step-number" aria-hidden="true">01</span>
              </li>
              <li>
                <span className="login-workflow-icon"><BarcodeOutlined aria-hidden="true" /></span>
                <div><strong>血样处理核对</strong><span>采血管与分装管对应</span></div>
                <span className="login-step-number" aria-hidden="true">02</span>
              </li>
              <li>
                <span className="login-workflow-icon"><FileSearchOutlined aria-hidden="true" /></span>
                <div><strong>记录追溯</strong><span>按实验查阅扫码与更改记录</span></div>
                <span className="login-step-number" aria-hidden="true">03</span>
              </li>
            </ol>
          </div>
          <span className="login-story-footer">标签打印 · 扫码核对 · 操作留痕</span>
        </section>
        <section className="login-form-panel" aria-labelledby="login-title">
          <div className="login-form-heading">
            <Typography.Title id="login-title" level={2}>欢迎使用</Typography.Title>
            <Typography.Text type="secondary">登录后选择实验，开始标签与核对操作</Typography.Text>
          </div>
          <Form<LoginFormValues>
            layout="vertical"
            onFinish={handleFinish}
          >
            <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
              <Input prefix={<UserOutlined aria-hidden="true" />} placeholder="请输入账号" autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined aria-hidden="true" />} placeholder="请输入密码" autoComplete="current-password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" loading={submitting} block>
              登录
            </Button>
          </Form>
          <div className="login-hint">
            <LockOutlined aria-hidden="true" /> 请使用管理员分配的账号登录
          </div>
        </section>
      </div>
    </main>
  );
}
