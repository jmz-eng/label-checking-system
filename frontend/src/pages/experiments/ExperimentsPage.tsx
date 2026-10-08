import { experimentPagination, searchText } from './shared';
import {
  Alert,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Space,
  Spin,
  Table,
  Typography,
} from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { experimentApi } from '../../api/experiments';
import { useAuth } from '../../stores/AuthContext';
import type { Experiment, Mapping, Purpose, Session, Tube } from '../../types/experiments';
import { GroupsPanel } from './GroupsPanel';
import { PurposesPanel } from './PurposesPanel';
import { ImportsPanel } from './ImportsPanel';
import { TubesPanel } from './TubesPanel';
import { PrintPanel } from './PrintPanel';
import { ScanPanel } from './ScanPanel';
import { RecordsPanel } from './RecordsPanel';
import { WorkspaceNavigation, workspaceViews } from './WorkspaceNavigation';
import { WorkspaceOverview } from './WorkspaceOverview';
import { CommandFeedback, errorText, NativeSelect, useCommand } from './shared';
export function ExperimentsPage() {
  const { hasPermission } = useAuth();
  const [params, setParams] = useSearchParams();
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<{ projectCode: string; projectName: string }>();
  const [current, setCurrent] = useState<Session | null>(null);
  const experiment = experiments.find((e) => e.id === Number(params.get('experiment')));
  const matchingExperiments = experiments.filter((e) => searchText(`${e.projectCode} ${e.projectName}`).includes(searchText(search)));
  const select = (id: number, tab = 'overview') => setParams({ experiment: String(id), tab });
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setExperiments(await experimentApi.list());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    let active = true;
    void experimentApi
      .currentSession()
      .then((s) => {
        if (active && s.id) setCurrent(s as Session);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [load]);
  const command = useCommand<Experiment>(
    async (created) => {
      setCreating(false);
      await load();
      select(created.id);
    },
    undefined,
    'create',
  );
  async function create() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    void command.execute('/api/experiments', values);
  }
  return (
    <Space direction="vertical" className="page-stack experiment-page" size="middle">
      <header className="workspace-page-header">
        <div className="experiment-page-title">
          <Typography.Title level={2}>{experiment ? '实验工作台' : '实验列表'}</Typography.Title>
          <Button
            disabled={!hasPermission('project:create') || command.busy || !!command.pending}
            title={!hasPermission('project:create') ? '当前账号没有添加实验权限' : undefined}
            onClick={() => {
              setCreating(true);
              form.resetFields();
            }}
          >
            添加实验
          </Button>
        </div>
        {experiment ? (
          <Button onClick={() => setParams({})}>返回实验列表</Button>
        ) : (
          <Space wrap>
          <Input.Search
            aria-label="查找实验"
            placeholder="按课题号或实验名称查找"
            allowClear
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ width: 280 }}
          />
        <NativeSelect
          label="选择实验"
          value=""
          onChange={(value) => (value ? select(Number(value)) : setParams({}))}
          options={matchingExperiments.map((e) => ({
            value: String(e.id),
            label: `${e.projectCode} · ${e.projectName}`,
          }))}
          placeholder="选择要操作的实验"
        />
          <span>匹配 {matchingExperiments.length} 个实验</span>
          </Space>
        )}
      </header>
      {error && (
        <Alert
          type="error"
          message={error}
          action={<Button onClick={() => void load()}>重新加载实验</Button>}
        />
      )}
      <CommandFeedback command={command} allowed={hasPermission('project:create')} />
      {current?.state === 'FAILED' && (
        <Alert
          type="error"
          message={`当前账号有未解决的失败核对：${experiments.find((e) => e.id === current.projectId)?.projectCode || current.projectId} · ${current.collectDate} · ${current.timePoint} · ${current.purposeSnapshot.name}。请先纠正或异常结束，切换页面不能跳过。`}
          action={
            <Button
              onClick={() =>
                select(current.projectId, current.stage === 'COLLECTION' ? 'collection' : 'aliquot')
              }
            >
              返回失败核对
            </Button>
          }
        />
      )}
      {loading ? (
        <Spin />
      ) : experiment ? (
        <Workspace
          key={experiment.id}
          experiment={experiment}
          tab={params.get('tab') || 'overview'}
          onTab={(tab) => select(experiment.id, tab)}
          onSession={setCurrent}
          onReturn={(session) =>
            select(session.projectId, session.stage === 'COLLECTION' ? 'collection' : 'aliquot')
          }
          current={current}
        />
      ) : (
        <Table
          pagination={{ ...experimentPagination }}
          rowKey="id"
          dataSource={matchingExperiments}
          locale={{
            emptyText: <Empty description={searchText(search) ? "未找到匹配实验，请调整课题号或名称" : "尚无实验，请添加实验后上传资料"} />,
          }}
          columns={[
            { title: '试验编号', dataIndex: 'projectCode' },
            { title: '实验名称', dataIndex: 'projectName' },
            {
              title: '操作',
              render: (_, e) => <Button onClick={() => select(e.id)}>进入实验</Button>,
            },
          ]}
        />
      )}
      <Modal
        title="添加实验"
        open={creating}
        onCancel={() => {
          if (!command.busy && !command.pending) setCreating(false);
        }}
        footer={
          <Button
            type="primary"
            loading={command.busy}
            disabled={command.busy || !!command.pending}
            onClick={() => void create()}
          >
            保存实验
          </Button>
        }
      >
        <Form form={form} layout="vertical" disabled={command.busy || !!command.pending}>
          <Form.Item
            label="试验编号"
            name="projectCode"
            rules={[{ required: true, message: '请填写试验编号' }]}
          >
            <Input maxLength={64} />
          </Form.Item>
          <Form.Item
            label="实验名称"
            name="projectName"
            rules={[{ required: true, message: '请填写实验名称' }]}
          >
            <Input />
          </Form.Item>
        </Form>
        <CommandFeedback command={command} allowed={hasPermission('project:create')} />
      </Modal>
    </Space>
  );
}
function Workspace({
  experiment,
  tab,
  onTab,
  onSession,
  onReturn,
  current,
}: {
  experiment: Experiment;
  tab: string;
  onTab: (tab: string) => void;
  onSession: (session: Session) => void;
  onReturn: (session: Session) => void;
  current: Session | null;
}) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const sequence = useRef(0);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const [mappings, purposes, tubes] = await Promise.all([
        experimentApi.mappings(experiment.id),
        experimentApi.purposes(experiment.id),
        experimentApi.tubes(experiment.id),
      ]);
      if (alive.current && request === sequence.current) {
        setMappings(mappings);
        setPurposes(purposes);
        setTubes(tubes);
        setReady(true);
      }
    } catch (error) {
      if (alive.current && request === sequence.current) {
        setError(errorText(error));
        setMappings([]);
        setPurposes([]);
        setTubes([]);
      }
      throw error;
    } finally {
      if (alive.current && request === sequence.current) setLoading(false);
    }
  }, [experiment.id]);
  useEffect(() => {
    alive.current = true;
    void refresh().catch(() => {});
    return () => {
      alive.current = false;
    };
  }, [refresh]);
  const activeTab = workspaceViews.some((view) => view.key === tab) ? tab : 'overview';
  const props = { projectId: experiment.id, purposes, tubes, refresh };
  return (
    <div className="experiment-workspace">
      <div className="workspace-trial-heading">
        <span className="workspace-eyebrow">当前实验</span>
        <Typography.Title level={3}>
          {experiment.projectCode} · {experiment.projectName}
        </Typography.Title>
      </div>
      <div className="workspace-layout">
        <WorkspaceNavigation active={activeTab} onNavigate={onTab} />
        <section className="workspace-main" aria-label="当前实验工作区">
          {error && (
            <Alert
              type="error"
              message={error}
              action={<Button onClick={() => void refresh().catch(() => {})}>重新加载实验资料</Button>}
            />
          )}
          {loading && !ready ? (
            <Spin />
          ) : (
            !error && (
              <div key={activeTab} className="workspace-view">
                {activeTab === 'overview' && (
                  <WorkspaceOverview
                    mappings={mappings}
                    purposes={purposes}
                    tubes={tubes}
                    current={current?.projectId === experiment.id ? current : null}
                    onNavigate={onTab}
                  />
                )}
                {activeTab === 'groups' && (
                  <GroupsPanel projectId={experiment.id} mappings={mappings} refresh={refresh} />
                )}
                {activeTab === 'purposes' && (
                  <PurposesPanel projectId={experiment.id} purposes={purposes} refresh={refresh} />
                )}
                {activeTab === 'imports' && (
                  <ImportsPanel {...props} projectCode={experiment.projectCode} mappings={mappings} />
                )}
                {activeTab === 'collection-tubes' && <TubesPanel {...props} kind="COLLECTION" />}
                {activeTab === 'aliquot-tubes' && <TubesPanel {...props} kind="ALIQUOT" />}
                {activeTab === 'print' && <PrintPanel {...props} />}
                {(activeTab === 'collection' || activeTab === 'aliquot') && (
                  <ScanPanel
                    experiment={experiment}
                    stage={activeTab === 'collection' ? 'COLLECTION' : 'ALIQUOT'}
                    tubes={tubes}
                    purposes={purposes}
                    onSession={onSession}
                    onReturn={onReturn}
                  />
                )}
                {(activeTab === 'records' || activeTab === 'changes') && (
                  <RecordsPanel
                    projectId={experiment.id}
                    changes={activeTab === 'changes'}
                    purposes={purposes}
                  />
                )}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
