import type { TaskStatus } from '../types';

export const taskStatusText: Record<TaskStatus, string> = {
  PRINTED: '待贴标',
  BOUND: '待核对',
  VERIFIED: '已通过',
  RECORDED: '已录入',
  VOIDED: '已作废',
};

export const scanActionText: Record<string, string> = {
  BIND: '贴标绑定',
  VERIFY: '操作核对',
  RECORD: '录入确认',
};

export function formatDateTime(value?: string): string {
  if (!value) return '-';
  return value.replace('T', ' ').slice(0, 19);
}
