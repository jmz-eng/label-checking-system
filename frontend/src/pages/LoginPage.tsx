import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Form, Input, Typography, message } from 'antd';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../stores/AuthContext';

interface LoginFormValues {
  username: string;
  password: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleFinish = async (values: LoginFormValues) => {
    setSubmitting(true);
    try {
      await login(values.username, values.password);
      navigate(from, { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">
          <div className="brand-mark large">
            <img src="/favicon.svg" alt="" aria-hidden="true" />
          </div>
          <div>
            <Typography.Title level={3}>标签防错管理系统</Typography.Title>
            <Typography.Text type="secondary">采血样品扫码核对与追溯</Typography.Text>
          </div>
        </div>
        <Form<LoginFormValues>
          layout="vertical"
          onFinish={handleFinish}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true, message: '请输入账号' }]}>
            <Input prefix={<UserOutlined />} placeholder="admin / tech / analyst / auditor" size="large" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" loading={submitting} block>
            登录
          </Button>
        </Form>
        <div className="login-hint">
          请使用管理员分配的账号登录，账号权限由角色配置统一控制。
        </div>
      </div>
    </div>
  );
}
