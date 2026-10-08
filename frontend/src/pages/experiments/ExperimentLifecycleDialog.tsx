import { Alert, Button, Checkbox, Input, Modal, Space } from 'antd';
import { useState } from 'react';
import type { Experiment } from '../../types/experiments';

export function ExperimentLifecycleDialog({ experiment, restore, blocked, feedback, onCancel, onConfirm }: {
  experiment: Experiment;
  restore: boolean;
  blocked: boolean;
  feedback: React.ReactNode;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const action = restore ? '恢复' : '删除';
  return (
    <Modal title={`${action}实验`} open onCancel={onCancel} closable={!blocked} maskClosable={!blocked}
      footer={<Space>
        <Button disabled={blocked} onClick={onCancel}>取消</Button>
        <Button type="primary" danger={!restore} disabled={blocked || !reason.trim() || !confirmed}
          onClick={() => onConfirm(reason.trim())}>确认{action}</Button>
      </Space>}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <strong>{experiment.projectCode} · {experiment.projectName}</strong>
        <Alert type="warning" message={restore ? '恢复后，实验将重新出现在正常列表并允许继续操作。' : '删除后从正常列表移除，停止新操作。附件及历史核对记录保留，管理员可恢复；有人正在核对或有失败待处理时禁止删除。'} />
        <label htmlFor="experiment-lifecycle-reason">操作原因</label>
        <Input.TextArea id="experiment-lifecycle-reason" value={reason} onChange={(e) => setReason(e.target.value)}
          maxLength={2000} rows={3} disabled={blocked} />
        <Checkbox disabled={blocked} checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
          我确认{action}该实验并保留本次操作记录
        </Checkbox>
        {feedback}
      </Space>
    </Modal>
  );
}
