import { experimentPagination } from './shared';
import { Alert, Button, Checkbox, Form, Input, Modal, Space, Table, Tag } from 'antd';
import { useState } from 'react';
import { experimentPath } from '../../api/experiments';
import { useAuth } from '../../stores/AuthContext';
import type { Purpose } from '../../types/experiments';
import { CommandFeedback, SectionTitle, useCommand } from './shared';
export function PurposesPanel({
  projectId,
  purposes,
  refresh,
}: {
  projectId: number;
  purposes: Purpose[];
  refresh: () => Promise<void>;
}) {
  const { hasPermission } = useAuth();
  const [editing, setEditing] = useState<Purpose | 'new' | null>(null);
  const [voiding, setVoiding] = useState<Purpose | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState('');
  const [form] = Form.useForm<{
    name: string;
    collectionKeywords: string;
    aliquotKeywords: string;
    reason?: string;
  }>();
  const command = useCommand<Purpose>(
    async () => {
      setEditing(null);
      setVoiding(null);
      await refresh();
    },
    undefined,
    `${projectId}:purposes`,
  );
  const blocked = command.busy || !!command.pending || !hasPermission('sample:generate');
  function edit(p: Purpose | 'new') {
    setEditing(p);
    setConfirmed(false);
    setValidation('');
    form.setFieldsValue(
      p === 'new'
        ? { name: '', collectionKeywords: '', aliquotKeywords: '', reason: '' }
        : {
            name: p.name,
            collectionKeywords: p.collectionKeywords.join('\n'),
            aliquotKeywords: p.aliquotKeywords.join('\n'),
            reason: '',
          },
    );
  }
  async function save() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    if (!confirmed) {
      setValidation('请明确确认用途与配对规则');
      return;
    }
    if (editing !== 'new' && !values.reason?.trim()) {
      setValidation('请填写原因');
      return;
    }
    void command.execute(
      `${experimentPath(projectId)}/purposes${editing !== 'new' && editing ? `/${editing.id}` : ''}`,
      {
        ...values,
        collectionKeywords: values.collectionKeywords
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
        aliquotKeywords: values.aliquotKeywords
          .split('\n')
          .map((v) => v.trim())
          .filter(Boolean),
        confirmed: true,
      },
    );
  }
  return (
    <Space direction="vertical" className="page-stack" size="middle">
      <SectionTitle title="用途与允许配对规则">
        <Button disabled={blocked} onClick={() => edit('new')}>
          新增用途
        </Button>
      </SectionTitle>
      <Alert
        type="info"
        message="同一用途下的采血管与分装管允许配对。两类关键词可以不同，每行一个关键词；识别结果仍需导入者确认。"
      />
      <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      <Table
        pagination={{ ...experimentPagination }}
        rowKey="id"
        dataSource={purposes}
        scroll={{ x: 750 }}
        columns={[
          { title: '用途', dataIndex: 'name' },
          {
            title: '采血关键词',
            render: (_, p) => p.collectionKeywords.join('、'),
          },
          {
            title: '分装关键词',
            render: (_, p) => p.aliquotKeywords.join('、'),
          },
          { title: '版本', dataIndex: 'version' },
          {
            title: '状态',
            render: (_, p) => (
              <Tag color={p.active ? 'green' : 'red'}>{p.active ? '已确认' : '已停用'}</Tag>
            ),
          },
          {
            title: '操作',
            render: (_, p) => (
              <Space>
                <Button disabled={blocked || !p.active} onClick={() => edit(p)}>
                  更正规则
                </Button>
                <Button
                  danger
                  disabled={blocked || !p.active}
                  onClick={() => {
                    setVoiding(p);
                    setReason('');
                    setValidation('');
                  }}
                >
                  停用用途
                </Button>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing === 'new' ? '新增用途' : '更正用途规则'}
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
            保存用途
          </Button>
        }
      >
        <Form layout="vertical" form={form} disabled={blocked}>
          <Form.Item
            label="用途名称"
            name="name"
            rules={[{ required: true, message: '请填写用途名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="采血管关键词（每行一个）" name="collectionKeywords">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item label="分装管关键词（每行一个）" name="aliquotKeywords">
            <Input.TextArea rows={3} />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item label="更正原因" name="reason">
              <Input.TextArea />
            </Form.Item>
          )}
        </Form>
        <Checkbox checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)}>
          我确认这组用途及允许配对规则
        </Checkbox>
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
      <Modal
        title="停用用途"
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
              void command.execute(`${experimentPath(projectId)}/purposes/${voiding?.id}/delete`, {
                reason,
              });
            }}
          >
            确认停用用途
          </Button>
        }
      >
        <Alert type="warning" message="停用后，该用途下的管子不能再打印或核对。" />
        <Input.TextArea
          aria-label="停用用途原因"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {validation && <Alert type="error" message={validation} />}
        <CommandFeedback command={command} allowed={hasPermission('sample:generate')} />
      </Modal>
    </Space>
  );
}
