export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

export interface UserProfile {
  id: number;
  username: string;
  realName: string;
  department: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

export interface Project {
  id: number;
  projectCode: string;
  projectName: string;
  testArticle: string;
  sponsor?: string;
  status: string;
  createdAt: string;
}

export interface SampleTask {
  id: number;
  projectId: number;
  projectCode: string;
  projectName: string;
  testArticle: string;
  animalNo: string;
  groupNo?: string;
  gender?: string;
  labelCode: string;
  tubeNo?: string;
  sampleType: string;
  timePoint: string;
  plannedCollectDate: string;
  status: TaskStatus;
  createdAt: string;
}

export type TaskStatus = 'PRINTED' | 'BOUND' | 'VERIFIED' | 'RECORDED' | 'VOIDED';

export interface GenerateSampleTaskRow {
  animalNo: string;
  groupNo?: string;
  gender?: string;
  sampleType: string;
  timePoint: string;
  plannedCollectDate: string;
  tubeNo?: string;
}

export interface ScanResult {
  passed: boolean;
  message: string;
  taskStatus: TaskStatus;
  task: SampleTask;
}

export interface ScanRecord {
  id: number;
  labelCode: string;
  actionType: string;
  expectedSummary: string;
  scannedPayload: string;
  result: 'PASS' | 'FAIL';
  message: string;
  operatorName: string;
  createdAt: string;
}

export interface WorkbenchSummary {
  totalTasks: number;
  checkedTasks: number;
  passedTasks: number;
  failedRecords: number;
  pendingTasks: number;
  traceRecords: number;
  checkedRate: number;
  passedRate: number;
  exceptionRate: number;
  pendingRate: number;
}

export interface AuditLog {
  id: number;
  operatorName: string;
  module: string;
  operation: string;
  businessKey: string;
  detail: string;
  createdAt: string;
}

export interface AppMenu {
  id: number;
  parentId: number;
  menuKey: string;
  menuName: string;
  routePath?: string;
  component?: string;
  permissionCode?: string;
  icon?: string;
  sortOrder: number;
  visible: boolean;
  status: string;
  children: AppMenu[];
}

export interface Permission {
  id: number;
  permissionCode: string;
  permissionName: string;
  module: string;
}

export interface Role {
  id: number;
  roleCode: string;
  roleName: string;
  description?: string;
  permissionCodes: string[];
}

export interface SystemUser {
  id: number;
  username: string;
  realName: string;
  department?: string;
  status: 'ENABLED' | 'DISABLED';
  roleIds: number[];
  roleNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Notice {
  id: number;
  title: string;
  content: string;
  noticeType: 'INFO' | 'WARNING' | 'SUCCESS';
  publishStatus: 'DRAFT' | 'PUBLISHED';
  creatorName: string;
  publishedAt?: string;
  createdAt: string;
}
