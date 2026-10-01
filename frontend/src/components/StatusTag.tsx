import {
  CheckCircleFilled,
  CloseCircleFilled,
  ClockCircleFilled,
  FileDoneOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import type { TaskStatus } from '../types';
import { taskStatusText } from '../utils/status';

const taskStatusIcon: Record<TaskStatus, ReactNode> = {
  PRINTED: <ClockCircleFilled />,
  BOUND: <LinkOutlined />,
  VERIFIED: <CheckCircleFilled />,
  RECORDED: <FileDoneOutlined />,
  VOIDED: <CloseCircleFilled />,
};

export function StatusTag({ status }: { status: TaskStatus }) {
  return (
    <span className={`task-status-tag task-status-tag-${status.toLowerCase()}`}>
      <span className="task-status-icon" aria-hidden="true">
        {taskStatusIcon[status]}
      </span>
      <span className="task-status-label">{taskStatusText[status] ?? status}</span>
    </span>
  );
}
