import { Alert, Button, Checkbox, Input, Modal, Space, Typography } from 'antd';
import type { InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { experimentApi, experimentPath } from '../../api/experiments';
import { useAuth } from '../../stores/AuthContext';
import { humanizeApiMessage } from '../../utils/apiMessage';
import type { Experiment, Kind, Purpose, Session, Tube } from '../../types/experiments';
import {
  CommandFeedback,
  errorText,
  NativeSelect,
  purposeOptions,
  shanghaiTime,
  TubeFields,
  useCommand,
} from './shared';
const pendingNames = {
  CHIP: '扫描动物芯片',
  COLLECTION_TUBE: '扫描采血管',
  SOURCE_TUBE: '扫描来源采血管',
  ALIQUOT_TUBE: '扫描分装管',
  NONE: '本轮已结束',
};
export function ScanPanel({
  experiment,
  stage,
  tubes,
  purposes,
  onSession,
  onReturn,
}: {
  experiment: Experiment;
  stage: Kind;
  tubes: Tube[];
  purposes: Purpose[];
  onSession: (s: Session) => void;
  onReturn: (s: Session) => void;
}) {
  const { hasPermission } = useAuth();
  const permitted = hasPermission(stage === 'COLLECTION' ? 'sample:verify' : 'sample:record');
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [collectDate, setCollectDate] = useState('');
  const [timePoint, setTimePoint] = useState('');
  const [purposeId, setPurposeId] = useState('');
  const [content, setContent] = useState('');
  const [validation, setValidation] = useState('');
  const [remark, setRemark] = useState('');
  const [closing, setClosing] = useState(false);
  const [reselecting, setReselecting] = useState(false);
  const [confirmReselect, setConfirmReselect] = useState(false);
  const [sound, setSound] = useState(false);
  const [retainSource, setRetainSource] = useState(true);
  const input = useRef<InputRef>(null);
  const audio = useRef<AudioContext | null>(null);
  const restoreSequence = useRef(0);
  const alive = useRef(true);
  function accept(next: Session) {
    if (!alive.current) return;
    setSession(next);
    onSession(next);
    if (next.projectId === experiment.id && next.stage === stage) {
      setCollectDate(next.collectDate);
      setTimePoint(next.timePoint);
      setPurposeId(next.purposeId);
    }
  }
  function beep(failed: boolean) {
    if (!sound) return;
    try {
      const ctx = audio.current || new AudioContext();
      audio.current = ctx;
      void ctx
        .resume()
        .then(() => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.frequency.value = failed ? 220 : 880;
          gain.gain.value = 0.05;
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.start();
          oscillator.stop(ctx.currentTime + 0.18);
        })
        .catch(() => {});
    } catch {
      /* Audio rejection must never interfere with saved verification. */
    }
  }
  const command = useCommand<Session>(
    async () => {
      // An idempotent POST can return a saved response from an older round/session.
      // Only the current-session lookup may establish the displayed current state.
      setLoaded(false);
      setRestoreError('');
      const current = await experimentApi.currentSession();
      if (!alive.current) return;
      if (current.id) accept(current as Session);
      else setSession(null);
      setLoaded(true);
      setContent('');
      setValidation('');
      setRemark('');
      setClosing(false);
      setReselecting(false);
      beep(current.state === 'FAILED');
      setTimeout(() => input.current?.focus(), 0);
    },
    async () => {
      try {
        const current = await experimentApi.currentSession();
        if (current.id) accept(current as Session);
      } catch (e) {
        setRestoreError(errorText(e));
      }
    },
    'scanner',
    true,
  );
  async function restore() {
    const sequence = ++restoreSequence.current;
    setLoaded(false);
    setRestoreError('');
    try {
      const current = await experimentApi.currentSession();
      if (sequence !== restoreSequence.current || !alive.current) return;
      if (current.id) {
        const detail = await experimentApi.session(current.id);
        if (sequence !== restoreSequence.current || !alive.current) return;
        accept(detail);
      } else setSession(null);
      setLoaded(true);
    } catch (e) {
      if (alive.current && sequence === restoreSequence.current)
        setRestoreError(`未能恢复当前核对：${errorText(e)}`);
    }
  }
  useEffect(() => {
    alive.current = true;
    void restore();
    return () => {
      alive.current = false;
    }; // The keyed panel has one immutable experiment/stage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (command.pending?.body.content && typeof command.pending.body.content === 'string')
      setContent(command.pending.body.content);
  }, [command.pending]);
  useEffect(() => {
    if (loaded && session?.pending !== 'NONE' && !command.busy) input.current?.focus();
  }, [loaded, session?.pending, session?.round, command.busy]);
  const matching =
    !!session &&
    session.projectId === experiment.id &&
    session.stage === stage &&
    session.state !== 'SUPERSEDED';
  const foreignFailed = !!session && session.state === 'FAILED' && !matching;
  const blocked =
    !permitted || command.busy || !!command.pending || !loaded || !!restoreError || foreignFailed;
  const lockContext = matching && session.state !== 'ABORTED' && !reselecting;
  const validTubes = tubes.filter(
    (t) =>
      t.kind === stage &&
      t.status === 'ACTIVE' &&
      t.confirmed &&
      purposes.some((p) => p.id === t.purposeId && p.active && p.confirmed),
  );
  const dates = [...new Set(validTubes.map((t) => t.collectDate))].sort();
  const times = [...new Set(validTubes.map((t) => t.timePoint))].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }));
  const timeDates = (time: string) => dates.filter((date) => validTubes.some((t) => t.collectDate === date && t.timePoint === time));
  function chooseDate(date: string) {
    setCollectDate(date);
    setTimePoint('');
    setPurposeId('');
  }
  const expectedPurposes = purposeOptions(purposes).filter((p) =>
    validTubes.some(
      (t) =>
        t.purposeId === p.value &&
        (!collectDate || t.collectDate === collectDate) &&
        (!timePoint || t.timePoint === timePoint),
    ),
  );
  async function start() {
    if (!collectDate) {
      setValidation('请选择采样日期');
      return;
    }
    if (!timePoint) {
      setValidation('请选择时间点');
      return;
    }
    if (!purposeId) {
      setValidation('请选择本次用途');
      return;
    }
    setValidation('');
    void command.execute(`${experimentPath(experiment.id)}/sessions`, {
      stage,
      collectDate,
      timePoint,
      purposeId,
    });
  }
  function scan() {
    if (blocked || reselecting || !matching || session.pending === 'NONE') return;
    if (!content.trim()) {
      setValidation('请扫描或输入非空内容');
      input.current?.focus();
      return;
    }
    setValidation('');
    const action = session.pending === 'CHIP' ? 'chip' : 'tube';
    void command.execute(`/api/experiments/sessions/${session.id}/${action}`, {
      content,
    });
  }
  function close() {
    if (!remark.trim()) {
      setValidation('请填写异常结束原因');
      return;
    }
    setValidation('');
    setClosing(true);
  }
  const passed =
    loaded &&
    !restoreError &&
    !reselecting &&
    !command.busy &&
    !command.pending &&
    matching &&
    session.state === 'PASSED' &&
    session.lastResult?.result === 'PASS' &&
    (session.lastResult.round === undefined || session.lastResult.round === session.round);
  const stateText = reselecting
    ? '请选择新的采样条件'
    : !loaded
      ? '正在恢复核对状态'
      : !matching
        ? '尚未开始'
        : session.state === 'FAILED'
          ? `核对失败 · ${pendingNames[session.pending]}`
          : passed
            ? '核对通过'
            : session.state === 'ABORTED'
              ? '异常结束（不计为通过）'
              : session.state === 'PASSED'
                ? '等待确认保存结果'
                : pendingNames[session.pending];
  const result =
    reselecting || !loaded || !!restoreError || !!command.pending || command.busy
      ? undefined
      : matching &&
          session.lastResult?.round !== undefined &&
          session.lastResult.round !== session.round
        ? undefined
        : matching
          ? session.lastResult
          : undefined;
  return (
    <Space direction="vertical" className="page-stack workspace-scan-panel" size="middle">
      <div className="workspace-scan-heading">
        <span className="workspace-eyebrow">现场核对</span>
        <Typography.Title level={4}>
          {stage === 'COLLECTION' ? '采血核对' : '血样处理核对'}
        </Typography.Title>
      </div>
      <Alert
        type="info"
        message={
          stage === 'COLLECTION'
            ? '选定采样条件后先扫描动物芯片，再扫描采血管。每次换动物都要重新扫描芯片。'
            : '采样日期是原始采血日期。先扫具体来源采血管，该管已有采血通过记录才能继续扫分装管。'
        }
      />
      {!permitted && <Alert type="warning" message="当前账号没有此核对阶段的操作权限" />}
      {restoreError && (
        <Alert
          type="error"
          message={restoreError}
          action={<Button onClick={() => void restore()}>重新恢复核对</Button>}
        />
      )}
      {session && !matching && (
        <Alert
          type={foreignFailed ? 'error' : 'warning'}
          message={`当前账号还有${session.stage === 'COLLECTION' ? '采血' : '血样处理'}核对：试验 ${session.projectId} · ${session.collectDate} · ${session.timePoint} · ${session.purposeSnapshot.name}${foreignFailed ? '，失败尚未处理，不能开始其他核对。' : '。新建核对将由服务器结束原条件。'}`}
          action={<Button onClick={() => onReturn(session)}>返回当前核对</Button>}
        />
      )}
      <Alert
        type="info"
        message={`本实验已识别 ${times.length} 个时间点（来自已确认有效管子的时间点列）`}
        description={
          <Space direction="vertical">
            <span>时间点与采样日期对应；其他日期的时间点仍会显示，但须先切换到对应日期。</span>
            {dates.map((date) => (
              <Space wrap key={date}>
                <span>{date}：{times.filter((time) => timeDates(time).includes(date)).join('、')}</span>
                <Button disabled={blocked || lockContext} onClick={() => chooseDate(date)} aria-label={`选择日期 ${date}`}>选择该日期</Button>
              </Space>
            ))}
          </Space>
        }
      />
      <Space wrap className="experiment-toolbar workspace-scan-conditions">
        <NativeSelect
          label="采样日期"
          value={collectDate}
          onChange={chooseDate}
          options={dates.map((v) => ({ value: v, label: v }))}
          disabled={blocked || lockContext}
        />
        <NativeSelect
          label="时间点"
          value={timePoint}
          onChange={(v) => {
            setTimePoint(v);
            setPurposeId('');
          }}
          options={times.map((v) => ({
            value: v,
            label: !collectDate || timeDates(v).includes(collectDate) ? v : `${v}（采样日期 ${timeDates(v).join('、')}）`,
            disabled: !!collectDate && !timeDates(v).includes(collectDate),
          }))}
          disabled={blocked || lockContext}
        />
        <NativeSelect
          label="本次用途"
          value={purposeId}
          onChange={setPurposeId}
          options={expectedPurposes}
          disabled={blocked || lockContext}
        />
        <Button
          type="primary"
          disabled={blocked || lockContext}
          loading={command.busy}
          onClick={() => void start()}
        >
          {stage === 'COLLECTION' ? '开始采血核对' : '开始血样处理核对'}
        </Button>
      </Space>
      <p className="experiment-context">
        {experiment.projectCode} · 采样日期 {collectDate || '未选择'} · 时间点{' '}
        {timePoint || '未选择'} · 用途 {purposes.find((p) => p.id === purposeId)?.name || '未选择'}
        {matching ? ` · 第 ${session.round} 轮` : ''}
      </p>
      <div
        role="status"
        aria-live="polite"
        data-testid="scan-state"
        className={`experiment-scan-state ${session?.state === 'FAILED' && matching ? 'failed' : passed && !command.pending ? 'passed' : ''}`}
      >
        <strong>
          {command.busy
            ? '正在保存本次提交'
            : command.pending
              ? '结果未确认，重试本次提交'
              : stateText}
        </strong>
        {matching && session.animalNo && (
          <p>
            当前动物：{session.animalNo}
            {session.chipContent ? ` · 芯片 ${session.chipContent}` : ''}
          </p>
        )}
      </div>
      {validation && <Alert type="error" message={validation} />}
      <CommandFeedback command={command} allowed={permitted} />
      {result?.message && (
        <Alert
          showIcon
          type={
            result.result === 'FAIL'
              ? 'error'
              : result.result === 'PASS' && passed
                ? 'success'
                : 'info'
          }
          message={humanizeApiMessage(result.message)}
        />
      )}
      <div className="content-panel workspace-scanner">
        <label htmlFor="experiment-scanner">扫描内容</label>
        <Input
          id="experiment-scanner"
          aria-label="扫描内容"
          ref={input}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPressEnter={scan}
          disabled={
            blocked ||
            reselecting ||
            !matching ||
            session.pending === 'NONE' ||
            session.state === 'ABORTED' ||
            session.state === 'PASSED'
          }
          size="large"
          placeholder={matching ? pendingNames[session.pending] : '先选择条件并开始核对'}
        />
        <Space wrap className="experiment-toolbar">
          <Button
            type="primary"
            disabled={
              blocked ||
              reselecting ||
              !matching ||
              session.pending === 'NONE' ||
              session.state === 'ABORTED' ||
              session.state === 'PASSED'
            }
            loading={command.busy}
            onClick={scan}
          >
            提交扫描
          </Button>
          <Checkbox checked={sound} onChange={(e) => setSound(e.target.checked)}>
            核对提示音
          </Checkbox>
        </Space>
      </div>
      {matching && !reselecting && loaded && !command.pending && session.sourceSnapshot && (
        <div className="content-panel">
          <Typography.Title level={5}>当前来源采血管（本轮快照）</Typography.Title>
          <TubeFields tube={session.sourceSnapshot} />
        </div>
      )}
      {result?.actual && (
        <div className="content-panel">
          <Typography.Title level={5}>实际扫描管子（本次保存快照）</Typography.Title>
          <TubeFields tube={result.actual} />
        </div>
      )}
      {matching && (
        <div className="content-panel">
          <Space wrap>
            <Button
              disabled={blocked || session.state === 'FAILED'}
              onClick={() => setConfirmReselect(true)}
            >
              重新选择采样条件
            </Button>
            <Button
              disabled={blocked || reselecting || (!passed && session.state !== 'ABORTED')}
              onClick={() =>
                void command.execute(
                  `/api/experiments/sessions/${session.id}/next`,
                  stage === 'ALIQUOT' ? { retainSource } : {},
                )
              }
            >
              下一轮
            </Button>
            {stage === 'ALIQUOT' && (
              <Checkbox
                checked={retainSource}
                disabled={blocked}
                onChange={(e) => setRetainSource(e.target.checked)}
              >
                下一支分装管保留当前来源
              </Checkbox>
            )}
          </Space>
          <p>
            核对通过只表示对应关系正确，不表示采血或处理已经完成。失败时请拿正确管重扫，或填写原因后明确异常结束。
          </p>
          <label htmlFor="scan-close-reason">异常结束原因</label>
          <Input.TextArea
            id="scan-close-reason"
            aria-label="异常结束原因"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            disabled={blocked || session.state !== 'FAILED'}
            rows={2}
          />
          <Button danger disabled={blocked || session.state !== 'FAILED'} onClick={close}>
            确认异常结束
          </Button>
          <p>需要切换条件时，使用重新选择采样条件；失败轮必须先纠正通过或异常结束。</p>
          {session.lastResult && (
            <Typography.Text type="secondary">
              最近保存记录：{shanghaiTime(session.lastResult.createdAt)}
              （上海时间） · {session.lastResult.actorName} · {session.lastResult.result}
              {session.lastResult.round !== session.round ? '，属于上一轮' : ''}
            </Typography.Text>
          )}
        </div>
      )}
      <Modal
        title="重新选择采样条件"
        open={confirmReselect}
        onCancel={() => setConfirmReselect(false)}
        footer={
          <Button
            type="primary"
            disabled={blocked || session?.state === 'FAILED'}
            onClick={() => {
              setConfirmReselect(false);
              setReselecting(true);
              setCollectDate('');
              setTimePoint('');
              setPurposeId('');
              setContent('');
              setValidation('');
            }}
          >
            确认重新选择
          </Button>
        }
      >
        <Alert
          type="warning"
          message="重新选好条件并开始后，服务器将结束原核对上下文并保留历史。未完成轮不会记为通过；新的轮次需要重新扫描。"
        />
      </Modal>
      <Modal
        title="明确确认异常结束"
        open={closing}
        onCancel={() => {
          if (!command.pending && !command.busy) setClosing(false);
        }}
        footer={
          <Button
            danger
            disabled={blocked}
            loading={command.busy}
            onClick={() => {
              if (session)
                void command.execute(`/api/experiments/sessions/${session.id}/exception-close`, {
                  remark,
                  confirmed: true,
                });
            }}
          >
            明确确认结束
          </Button>
        }
      >
        <p>原因：{remark}</p>
        <Alert
          type="warning"
          message="异常结束不计为通过，不产生成功采血核对记录，也不能放行该来源管的分装核对。"
        />
        <CommandFeedback command={command} allowed={permitted} />
      </Modal>
    </Space>
  );
}
