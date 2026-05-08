import { EyeOutlined, LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { appErrorMessage } from '../utils/text';

export function LoginPage({
  onLogin,
  error,
  setError,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
  error: string;
  setError: (value: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[repeating-linear-gradient(135deg,#ffffff_0,#ffffff_34px,#f5f3ef_34px,#f5f3ef_36px)] px-6 py-10">
      <div className="login-card w-full max-w-157 rounded-5.5 border-5 border-[#222] bg-white px-10 py-14 shadow-[6px_6px_0_rgba(0,0,0,0.06)] md:px-16">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full border-5 border-[#222] bg-sky-100 text-5xl text-violet-800">
            <UserOutlined />
          </div>
          <h1 className="brand-title m-0 text-5xl font-extrabold tracking-tight text-slate-900 md:text-6xl">在线学习管理平台</h1>
        </div>

        <Form
          layout="vertical"
          initialValues={{ username: 'admin', password: 'admin123' }}
          onFinish={async (values: { username: string; password: string }) => {
            setSubmitting(true);
            setError('');
            try {
              await onLogin(values.username.trim(), values.password);
            } catch (requestError) {
              setError(appErrorMessage(requestError));
            } finally {
              setSubmitting(false);
            }
          }}
          className="space-y-0"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]} className="mb-7">
            <Input
              size="large"
              prefix={<UserOutlined className="text-violet-800" />}
              placeholder="请输入用户名"
              autoComplete="username"
              className="h-15.5 rounded-3.5 border-4 border-slate-300 px-4! text-xl"
            />
          </Form.Item>

          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]} className="mb-7">
            <Input.Password
              size="large"
              prefix={<LockOutlined className="text-amber-500" />}
              placeholder="请输入密码"
              autoComplete="current-password"
              iconRender={() => <EyeOutlined className="text-slate-400" />}
              className="h-15.5 rounded-3.5 border-4 border-slate-300 px-4! text-xl"
            />
          </Form.Item>

          {error ? <Alert className="mb-6 rounded-2xl border-3 border-rose-300" type="error" showIcon message={error} /> : null}

          <Button
            htmlType="submit"
            loading={submitting}
            className="h-15! w-full rounded-3.5 border-5! border-[#222] bg-sky-200 text-3xl font-extrabold text-slate-900 hover:border-[#222]! hover:bg-sky-200! hover:text-slate-900!"
          >
            登 录
          </Button>
        </Form>

        <p className="mb-0 mt-4! text-center text-lg text-slate-400 md:text-xl">测试账号：admin / admin123</p>
      </div>
    </div>
  );
}
