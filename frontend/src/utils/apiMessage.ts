const fieldNames: Record<string, string> = {
  projectId: '实验',
  projectCode: '试验编号',
  projectName: '实验名称',
  animalNo: '动物号',
  chipNo: '芯片号',
  timePoint: '时间点',
  collectDate: '采样日期',
  purposeId: '用途',
  sourceTubeId: '来源采血管',
  targetTubeId: '目标管子',
  labelInfo: '管标信息',
  kind: '管子类型',
  expiresAt: '失效时间',
  confirmed: '确认状态',
  requestId: '本次提交标识',
  remark: '异常结束原因',
  reason: '更正原因',
};
const fieldPattern = new RegExp(`\\b(${Object.keys(fieldNames).join('|')})\\b`, 'g');

// Translate only recognized field tokens for display; archived messages and scan content stay intact.
export function humanizeApiMessage(message?: string): string {
  return (message || '').replace(fieldPattern, (field) => fieldNames[field]);
}
