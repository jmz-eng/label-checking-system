import {
  ArrowRightOutlined,
  BarcodeOutlined,
  ExperimentOutlined,
  FileSearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useAuth } from '../../stores/AuthContext';
import type { Mapping, Purpose, Session, Tube } from '../../types/experiments';

export function WorkspaceOverview({
  mappings,
  purposes,
  tubes,
  current,
  onNavigate,
}: {
  mappings: Mapping[];
  purposes: Purpose[];
  tubes: Tube[];
  current: Session | null;
  onNavigate: (key: string) => void;
}) {
  const { hasPermission } = useAuth();
  const tasks = [
    {
      key: 'collection',
      title: '采血核对',
      permission: 'sample:verify',
      icon: <BarcodeOutlined />,
      sequence: ['动物芯片', '采血管'],
      description: '核对动物与采血管的对应关系，每次换动物重新扫描芯片。',
    },
    {
      key: 'aliquot',
      title: '血样处理核对',
      permission: 'sample:record',
      icon: <ExperimentOutlined />,
      sequence: ['来源采血管', '分装管'],
      description: '核对具体来源与分装管，来源管须已有采血核对通过记录。',
    },
  ];
  return (
    <div className="workspace-overview">
      <div className="workspace-overview-intro">
        <span className="workspace-eyebrow">现场核对</span>
        <h3>选择现场核对任务</h3>
        <p>进入后选择采样日期、时间点和用途，再开始本次核对。</p>
      </div>
      <div className="workspace-entry-grid">
        {tasks.map((task) => {
          const allowed = hasPermission(task.permission);
          return (
            <section className={`workspace-entry workspace-entry-${task.key}`} key={task.key}>
              <div className="workspace-entry-icon" aria-hidden="true">{task.icon}</div>
              <h4>{task.title}</h4>
              <div className="workspace-scan-sequence">
                <span>01 {task.sequence[0]}</span>
                <ArrowRightOutlined aria-hidden="true" />
                <span>02 {task.sequence[1]}</span>
              </div>
              <p>{task.description}</p>
              <Button
                type="primary"
                size="large"
                disabled={!allowed}
                aria-describedby={!allowed ? `permission-${task.key}` : undefined}
                onClick={() => onNavigate(task.key)}
              >
                进入{task.title}<ArrowRightOutlined aria-hidden="true" />
              </Button>
              {!allowed && (
                <p id={`permission-${task.key}`} className="workspace-permission">
                  当前账号没有{task.title}操作权限
                </p>
              )}
            </section>
          );
        })}
      </div>
      {current && ['IN_PROGRESS', 'FAILED'].includes(current.state) && (
        <section className={`workspace-resume ${current.state === 'FAILED' ? 'is-failed' : ''}`}>
          <div>
            <h4>{current.state === 'FAILED' ? '失败核对尚未处理' : '有进行中的核对'}</h4>
            <p>
              {current.stage === 'COLLECTION' ? '采血核对' : '血样处理核对'} · {current.collectDate}
              {' · '}{current.timePoint} · {current.purposeSnapshot.name} · 第 {current.round} 轮
            </p>
          </div>
          <Button onClick={() => onNavigate(current.stage === 'COLLECTION' ? 'collection' : 'aliquot')}>
            继续当前核对
          </Button>
        </section>
      )}
      <section className="workspace-materials">
        <div className="workspace-section-heading">
          <h4>实验资料概览</h4>
          <span>当前资料数量，仅供参考</span>
        </div>
        <dl>
          {[
            ['有效分组', mappings.filter((m) => m.active).length],
            ['用途记录', purposes.length],
            ['采血管记录', tubes.filter((t) => t.kind === 'COLLECTION').length],
            ['分装管记录', tubes.filter((t) => t.kind === 'ALIQUOT').length],
          ].map(([label, count]) => (
            <div key={label}><dt>{label}</dt><dd>{count}</dd></div>
          ))}
        </dl>
        <p>资料数量不代表完整性或核对通过；实际核对以本轮核对结果为准。</p>
      </section>
      <div className="workspace-secondary-grid">
        <section>
          <h4><SettingOutlined aria-hidden="true" /> 实验前准备</h4>
          <p>维护关系与用途、导入资料、准备管子标签。</p>
          <div>
            <Button onClick={() => onNavigate('groups')}>维护分组关系</Button>
            <Button onClick={() => onNavigate('imports')}>导入实验资料</Button>
            <Button onClick={() => onNavigate('print')}>准备标签打印</Button>
          </div>
        </section>
        <section>
          <h4><FileSearchOutlined aria-hidden="true" /> 查看追溯记录</h4>
          <p>查看核对结果与资料更改的历史快照。</p>
          <div>
            <Button onClick={() => onNavigate('records')}>查看核对记录</Button>
            <Button onClick={() => onNavigate('changes')}>查看更改记录</Button>
          </div>
        </section>
      </div>
    </div>
  );
}
