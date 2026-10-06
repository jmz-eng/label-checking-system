import { Alert, Button, Form, Input, Modal, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { experimentPath } from '../../api/experiments';
import { http } from '../../api/http';
import { useAuth } from '../../stores/AuthContext';
import type { ExperimentEvent, Mapping } from '../../types/experiments';
import { EventDetails } from './EventDetails';
import { CommandFeedback, errorText, SectionTitle, shanghaiTime, useCommand } from './shared';
export function GroupsPanel({
  projectId,
  mappings,
  refresh,
}: {
  projectId: number;
  mappings: Mapping[];
  refresh: () => Promise<void>;
}) {
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState<Mapping | 'new' | null>(null);
  const [voiding, setVoiding] = useState<Mapping | null>(null);
  const [reason, setReason] = useState('');
  const [validation, setValidation] = useState('');
  const [history, setHistory] = useState<ExperimentEvent[] | null>(null);
  const [form] = Form.useForm<{
    animalNo: string;
    chipNo: string;
    reason?: string;
  }>();
  const command = useCommand<Mapping>(
    async () => {
      setEditing(null);
      setVoiding(null);
      setValidation('');
      await refresh();
    },
    undefined,
    `${projectId}:groups`,
  );
  const blocked = command.busy || !!command.pending || !hasPermission('sample:generate');
  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (editing !== 'new' && !values.reason?.trim()) {
      setValidation('请填写原因');
      return;
    }
    void command.execute(
      `${experimentPath(projectId)}/mappings${editing !== 'new' && editing ? `/${editing.id}` : ''}`,
      values,
    );
  }
  function edit(mapping: Mapping | 'new') {
    setEditing(mapping);
    setValidation('');
    form.setFieldsValue(
      mapping === 'new'
        ? { animalNo: '', chipNo: '', reason: '' }
        : { animalNo: mapping.animalNo, chipNo: mapping.chipNo, reason: '' },
    );
  }
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <SectionTitle title="动物与芯片分组关系">
        <Button disabled={blocked} onClick={() => edit('new')}>
          新增分组
        </Button>
      </SectionTitle>
      <Alert
        type="info"
        message="动物号和芯片号按文本保存，保留前导零。更正与停用保留历史，后续核对使用最新有效关系。"
      />
      <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      <Table
        rowKey="id"
        dataSource={mappings}
        pagination={{ pageSize: 20 }}
        scroll={{ x: 700 }}
        columns={[
          { title: '动物号', dataIndex: 'animalNo' },
          { title: '芯片号', dataIndex: 'chipNo' },
          { title: '版本', dataIndex: 'version' },
          {
            title: '状态',
            render: (_, row) => (
              <Tag color={row.active ? 'green' : 'red'}>{row.active ? '有效' : '已停用'}</Tag>
            ),
          },
          {
            title: '操作',
            render: (_, row) => (
              <Space>
                <Button disabled={blocked || !row.active} onClick={() => edit(row)}>
                  更正关系
                </Button>
                <Button
                  danger
                  disabled={blocked || !row.active}
                  onClick={() => {
                    setVoiding(row);
                    setReason('');
                    setValidation('');
                  }}
                >
                  停用
                </Button>
                {hasPermission('audit:view') && (
                  <Button
                    onClick={() =>
                      void http
                        .get<ExperimentEvent[]>(
                          `${experimentPath(projectId)}/mappings/${row.id}/history`,
                        )
                        .then(setHistory)
                        .catch((e) => setValidation(errorText(e)))
                    }
                  >
                    变更历史
                  </Button>
                )}
              </Space>
            ),
          },
        ]}
      />
      {validation && !editing && !voiding && <Alert type="error" message={validation} />}
      <Modal
        title={editing === 'new' ? '新增分组' : '更正分组关系'}
        open={!!editing}
        onCancel={() => {
          if (!command.pending && !command.busy) setEditing(null);
        }}
        footer={
          <Button
            type="primary"
            disabled={blocked}
            loading={command.busy}
            onClick={() => void save()}
          >
            保存分组
          </Button>
        }
      >
        <Form layout="vertical" form={form} disabled={blocked}>
          <Form.Item
            label="动物号"
            name="animalNo"
            rules={[{ required: true, message: '请填写动物号' }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            label="芯片号"
            name="chipNo"
            rules={[{ required: true, message: '请填写芯片号' }]}
          >
            <Input maxLength={128} />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item label="更正原因" name="reason">
              <Input.TextArea />
            </Form.Item>
          )}
        </Form>
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
      <Modal
        title="停用分组关系"
        open={!!voiding}
        onCancel={() => {
          if (!command.pending && !command.busy) setVoiding(null);
        }}
        footer={
          <Button
            danger
            disabled={blocked}
            onClick={() => {
              if (!reason.trim()) {
                setValidation('请填写原因');
                return;
              }
              void command.execute(`${experimentPath(projectId)}/mappings/${voiding?.id}/delete`, {
                reason,
              });
            }}
          >
            确认停用
          </Button>
        }
      >
        <Input.TextArea
          aria-label="停用原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
      <Modal
        title="分组变更历史（原始快照）"
        open={history !== null}
        onCancel={() => setHistory(null)}
        footer={null}
      >
        {history?.map((event) => (
          <div key={event.id}>
            <p>
              {shanghaiTime(event.createdAt)} · {event.actorName} · {event.reason}
            </p>
            <EventDetails event={event} />
          </div>
        ))}
      </Modal>
    </Space>
  );
}
