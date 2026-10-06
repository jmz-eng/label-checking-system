export type Kind = 'COLLECTION' | 'ALIQUOT';
export type ImportKind = 'GROUP' | Kind;
export interface Experiment {
  id: number;
  projectCode: string;
  projectName: string;
  status: string;
}
export interface Mapping {
  id: string;
  projectId: number;
  animalNo: string;
  chipNo: string;
  active: boolean;
  version: number;
  createdAt: string;
}
export interface Purpose {
  id: string;
  projectId: number;
  name: string;
  collectionKeywords: string[];
  aliquotKeywords: string[];
  confirmed: boolean;
  active: boolean;
  version: number;
  createdAt: string;
}
export interface Tube {
  id: string;
  projectId: number;
  projectCode: string;
  kind: Kind;
  animalNo: string;
  timePoint: string;
  labelInfo: string;
  collectDate: string;
  purposeId?: string;
  confirmed: boolean;
  sourceTubeId: string;
  code: string;
  status: 'ACTIVE' | 'VOID';
  printed: boolean;
  version: number;
  replacesId: string;
  createdAt: string;
  expiresAt?: string;
  voidReason?: string;
  importId?: string;
  sourceSheet?: string;
  sourceRow?: number;
}
export interface TubeInput {
  kind: Kind;
  animalNo: string;
  timePoint: string;
  labelInfo: string;
  collectDate: string;
  purposeId?: string;
  confirmed?: boolean;
  sourceTubeId?: string;
  expiresAt?: string;
}
export interface ImportIssue {
  sheet: string;
  row: number;
  column: string;
  message: string;
}
export interface ImportRow {
  rowKey: string;
  sourceSheet: string;
  sourceRow: number;
  projectId: number;
  projectCode: string;
  animalNo: string;
  chipNo?: string;
  timePoint?: string;
  labelInfo?: string;
  collectDate?: string;
  kind?: Kind;
  suggestedPurposeId?: string;
  requiresConfirmation?: boolean;
}
export interface ConfirmedImportRow extends ImportRow {
  purposeId?: string;
  sourceTubeId?: string;
  confirmed?: boolean;
  importId?: string;
}
export interface ImportBatch {
  id: string;
  projectId: number;
  kind: ImportKind;
  fileName: string;
  hash: string;
  size: number;
  createdAt: string;
  status: 'PREVIEW' | 'INVALID' | 'REJECTED' | 'COMMITTED';
  duplicate: boolean;
  rows: ImportRow[];
  issues: ImportIssue[];
  commitIssues?: ImportIssue[];
  entityIds?: string[];
  confirmedRows?: ConfirmedImportRow[];
  duplicateBatches?: { importId: string; fileName: string; status: string }[];
  duplicateRows?: {
    rowKey: string;
    tubeId: string;
    importId: string;
    content: ImportRow;
    sourceSheet?: string;
    sourceRow?: number;
    status?: 'ACTIVE' | 'VOID';
    matchingRowKey?: string;
  }[];
  duplicateRowsLimit?: number;
}
export interface Session {
  id: string;
  projectId: number;
  ownerId: number;
  stage: Kind;
  collectDate: string;
  timePoint: string;
  purposeId: string;
  purposeSnapshot: Purpose;
  round: number;
  state: 'IN_PROGRESS' | 'FAILED' | 'PASSED' | 'ABORTED' | 'SUPERSEDED';
  pending: 'CHIP' | 'COLLECTION_TUBE' | 'SOURCE_TUBE' | 'ALIQUOT_TUBE' | 'NONE';
  animalNo?: string;
  chipContent?: string;
  mappingSnapshot?: Mapping;
  sourceTubeId?: string;
  sourceSnapshot?: Tube;
  targetTubeId?: string;
  lastResult?: ExperimentEvent;
  createdAt: string;
}
export interface ExperimentEvent {
  id: string;
  projectId: number;
  projectSnapshot: Experiment;
  action: string;
  result: 'CHANGE' | 'READY' | 'PASS' | 'FAIL' | 'ABORT';
  actorId: number;
  actorName: string;
  createdAt: string;
  sessionId?: string;
  round?: number;
  stage?: Kind;
  collectDate?: string;
  timePoint?: string;
  purposeId?: string;
  animalNo?: string;
  sourceTubeId?: string;
  targetTubeId?: string;
  scannedContent?: string;
  message?: string;
  expected?: Omit<Session, 'lastResult'>;
  actual?: Tube;
  entityId?: string;
  before?: object;
  after?: object;
  reason?: string;
  remark?: string;
  importId?: string;
}
export interface PrintRequest {
  id: string;
  projectId: number;
  actorId: number;
  createdAt: string;
  status: 'REQUEST_ACKNOWLEDGED';
  tubes: Tube[];
}
