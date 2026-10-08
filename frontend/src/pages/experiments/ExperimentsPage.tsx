import { experimentPagination, searchText } from './shared';
import { ArrowRightOutlined, ExperimentOutlined, PlusOutlined } from '@ant-design/icons';
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
import { ExperimentLifecycleDialog } from './ExperimentLifecycleDialog';
import { CommandFeedback, errorText, NativeSelect, useCommand } from './shared';
export function ExperimentsPage() {
  const { hasPermission, user } = useAuth();
  const isAdmin = !!user?.roles.includes('ADMIN');
  const [showDeleted, setShowDeleted] = useState(false);
  const [lifecycleTarget, setLifecycleTarget] = useState<Experiment | null>(null);
  const loadRequest = useRef(0);
  const invalidateLoad = useCallback(() => { ++loadRequest.current; }, []);
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
    const request = ++loadRequest.current;
    setLoading(true);
    setError('');
    try {
      const rows = await experimentApi.list(showDeleted && isAdmin);
      if (request === loadRequest.current) setExperiments(rows);
    } catch (e) {
      if (request === loadRequest.current) setError(errorText(e));
    } finally {
      if (request === loadRequest.current) setLoading(false);
    }
  }, [showDeleted, isAdmin]);
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
      invalidateLoad();
    };
  }, [load, invalidateLoad]);
  const command = useCommand<Experiment>(
    async (created) => {
      setCreating(false);
      await load();
      select(created.id);
    },
    undefined,
    'create',
  );
  const lifecycle = useCommand<Experiment>(async (saved) => {
    setLifecycleTarget(null);
    setExperiments((rows) => rows.filter((row) => row.id !== saved.id));
    setParams({});
    await load();
  }, undefined, 'project-lifecycle');
  async function create() {
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    void command.execute('/api/experiments', values);
  }
  return (
    <Space direction="vertical" className={`page-stack experiment-page ${experiment ? '' : 'experiment-selection-page'}`} size="middle">
      <header className="workspace-page-header">
        <div className="experiment-page-title">
          <div>
            <Typography.Title level={experiment ? 3 : 2}>{experiment ? `${experiment.projectCode} · ${experiment.projectName}` : showDeleted ? '已删除实验' : '实验列表'}</Typography.Title>
            {!experiment && <p className="experiment-page-description">{showDeleted ? '查看历史记录，或恢复需要继续使用的实验。' : '选择要开展的实验，进入标签准备、扫码核对与记录追溯。'}</p>}
          </div>
        </div>
        {!experiment && <Button
          type="primary"
          icon={<PlusOutlined aria-hidden="true" />}
          disabled={!hasPermission('project:create') || command.busy || !!command.pending}
          title={!hasPermission('project:create') ? '当前账号没有添加实验权限' : undefined}
          onClick={() => {
            setCreating(true);
            form.resetFields();
          }}
        >
          添加实验
        </Button>}
        {experiment && (
          <Button onClick={() => setParams({})}>返回实验列表</Button>
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
      {!lifecycleTarget && <CommandFeedback command={lifecycle} allowed={isAdmin} />}
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
          readOnly={experiment.status === 'DELETED'}
        />
      ) : (
        <section className="experiment-list-card" aria-label="实验选择">
          <div className="experiment-list-tools">
            <label className="experiment-field">
              <span>查找实验</span>
              <Input.Search
                aria-label="查找实验"
                placeholder="按课题号或实验名称查找"
                allowClear
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
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
            {isAdmin && <Button className="experiment-list-mode" disabled={lifecycle.busy || !!lifecycle.pending}
              onClick={() => { setExperiments([]); setShowDeleted(!showDeleted); setParams({}); }}>
              {showDeleted ? '正常实验' : '已删除实验'}
            </Button>}
          </div>
          <div className="experiment-list-summary"><strong>{showDeleted ? '已删除的实验' : '全部实验'}</strong><span>匹配 {matchingExperiments.length} 个实验</span></div>
          <Table
            className="experiment-list-table"
            tableLayout="fixed"
            pagination={{ ...experimentPagination }}
            rowKey="id"
            dataSource={matchingExperiments}
            locale={{
              emptyText: <Empty description={searchText(search) ? "未找到匹配实验，请调整课题号或名称" : "尚无实验，请添加实验后上传资料"} />,
            }}
            columns={[
              { title: '试验编号', dataIndex: 'projectCode', width: '32%', render: (value: string) => <span className="experiment-project-code"><ExperimentOutlined aria-hidden="true" />{value}</span> },
              { title: '实验名称', dataIndex: 'projectName', width: '40%' },
              {
                title: '操作',
                width: '28%',
                render: (_, e: Experiment) => <Space wrap className="experiment-list-actions">
                  {e.status === 'DELETED' ? <>
                    <Button type="link" onClick={() => select(e.id, 'records')}>核对记录</Button>
                    <Button type="link" onClick={() => select(e.id, 'changes')}>更改记录</Button>
                  </> : <Button type="link" onClick={() => select(e.id)}>进入实验<ArrowRightOutlined aria-hidden="true" /></Button>}
                  {isAdmin && <Button type="text" danger={e.status !== 'DELETED'} disabled={lifecycle.busy || !!lifecycle.pending}
                    onClick={() => setLifecycleTarget(e)}>
                    {e.status === 'DELETED' ? '恢复实验' : '删除实验'}
                  </Button>}
                </Space>,
              },
            ]}
          />
        </section>
      )}
      {lifecycleTarget && <ExperimentLifecycleDialog key={lifecycleTarget.id}
        experiment={lifecycleTarget} restore={lifecycleTarget.status === 'DELETED'}
        blocked={lifecycle.busy || !!lifecycle.pending}
        feedback={<CommandFeedback command={lifecycle} allowed={isAdmin} />}
        onCancel={() => { if (!lifecycle.busy && !lifecycle.pending) setLifecycleTarget(null); }}
        onConfirm={(reason) => { if (isAdmin) void lifecycle.execute(`/api/experiments/${lifecycleTarget.id}/${lifecycleTarget.status === 'DELETED' ? 'restore' : 'delete'}`, { reason, confirmed: true }); }} />}
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
  readOnly = false,
}: {
  experiment: Experiment;
  tab: string;
  onTab: (tab: string) => void;
  onSession: (session: Session) => void;
  onReturn: (session: Session) => void;
  current: Session | null;
  readOnly?: boolean;
}) {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const sequence = useRef(0);
  const alive = useRef(true);
  const activeTab = readOnly ? (tab === 'changes' ? 'changes' : 'records')
    : workspaceViews.some((view) => view.key === tab) ? tab : 'overview';
  const refresh = useCallback(async () => {
    if (!alive.current) return;
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
  }, [refresh, activeTab]);
  const props = { projectId: experiment.id, purposes, tubes, refresh };
  return (
    <div className="experiment-workspace">
      <div className="workspace-layout">
        <WorkspaceNavigation active={activeTab} onNavigate={onTab} readOnly={readOnly} />
        <section className="workspace-main" aria-label="当前实验工作区">
          {readOnly && <Alert type="warning" message="实验已删除，仅可查看追溯记录；需管理员恢复后才能继续操作。" />}
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
