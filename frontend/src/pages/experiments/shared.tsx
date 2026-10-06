import { Alert, Button, Descriptions, Space, Typography } from 'antd';
import { useRef, useState } from 'react';
import { ApiError, http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import type { Purpose, Tube } from '../../types/experiments';

export function shanghaiTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' });
}
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : '请求失败';
}
export function NativeSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  placeholder = '请选择',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="experiment-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
export const purposeOptions = (purposes: Purpose[]) =>
  purposes.filter((p) => p.active && p.confirmed).map((p) => ({ value: p.id, label: p.name }));
export function TubeFields({ tube }: { tube?: Tube }) {
  if (!tube) return null;
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, sm: 2 }}
      items={[
        { key: 'project', label: '试验编号', children: tube.projectCode },
        { key: 'animal', label: '动物号', children: tube.animalNo },
        { key: 'time', label: '时间点', children: tube.timePoint },
        { key: 'date', label: '采样日期', children: tube.collectDate },
        {
          key: 'info',
          label: '管标信息',
          children: <span className="preserve-text">{tube.labelInfo}</span>,
          span: 2,
        },
        { key: 'code', label: '二维码', children: tube.code },
        {
          key: 'id',
          label: '管子身份 / 版本',
          children: `${tube.id} / v${tube.version}`,
        },
      ]}
    />
  );
}
interface Pending {
  path: string;
  body: Record<string, unknown>;
}
// Keep the exact serialized action until the server response is known. Retry never creates a new UUID.
export function useCommand<T>(
  onSuccess: (data: T, path: string, body: Record<string, unknown>) => void | Promise<void>,
  onReject?: (error: ApiError, path: string) => void | Promise<void>,
  durableKey?: string,
) {
  const { user } = useAuth();
  const storageKey = durableKey ? `experiment-action:${user?.id}:${durableKey}` : undefined;
  const [pending, setPending] = useState<Pending | null>(() => {
    if (!storageKey) return null;
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Pending | null;
    } catch {
      return null;
    }
  });
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState(pending ? '结果未确认，请重试原操作以取得保存结果。' : '');
  const remember = (action: Pending | null) => {
    setPending(action);
    if (storageKey) {
      try {
        if (action) sessionStorage.setItem(storageKey, JSON.stringify(action));
        else sessionStorage.removeItem(storageKey);
      } catch {
        // The in-memory action still permits a safe retry when browser storage is unavailable.
      }
    }
  };
  async function perform(action: Pending) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setError('');
    remember(action);
    let data: T;
    try {
      data = await http.post<T, Record<string, unknown>>(action.path, action.body);
    } catch (caught) {
      const failure = caught instanceof ApiError ? caught : new ApiError(errorText(caught));
      if (failure.uncertain) {
        remember(action);
        setError(`结果未确认：${failure.message}。可重试本次提交。`);
      } else {
        remember(null);
        setError(failure.message);
        try {
          await onReject?.(failure, action.path);
        } catch (refreshFailure) {
          setError(`${failure.message}；重新读取结果失败：${errorText(refreshFailure)}`);
        }
      }
      running.current = false;
      setBusy(false);
      return;
    }
    remember(null);
    try {
      await onSuccess(data, action.path, action.body);
    } catch (caught) {
      setError(`操作已保存，重新加载资料失败：${errorText(caught)}`);
    }
    running.current = false;
    setBusy(false);
  }
  return {
    busy,
    error,
    pending,
    execute: (path: string, body: Record<string, unknown>) => {
      if (!pending)
        return perform({
          path,
          body: { ...body, requestId: crypto.randomUUID() },
        });
    },
    retry: () => (pending ? perform(pending) : undefined),
  };
}
export function CommandFeedback({
  command,
  allowed = true,
}: {
  allowed?: boolean;
  command: {
    error: string;
    pending: unknown;
    busy: boolean;
    retry: () => unknown;
  };
}) {
  return command.error ? (
    <Alert
      showIcon
      type={command.pending ? 'warning' : 'error'}
      message={command.error}
      action={
        command.pending ? (
          <Button
            disabled={!allowed || command.busy}
            loading={command.busy}
            onClick={() => void command.retry()}
          >
            重试原操作
          </Button>
        ) : undefined
      }
    />
  ) : null;
}
export function JsonDetail({ value }: { value: unknown }) {
  return <pre className="experiment-json">{JSON.stringify(value, null, 2)}</pre>;
}
export function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Space wrap className="experiment-section-title">
      <Typography.Title level={4}>{title}</Typography.Title>
      {children}
    </Space>
  );
}
