import { http } from './http';
import type { GenerateSampleTaskRow, SampleTask, ScanResult, TaskStatus } from '../types';

export interface GenerateSampleTasksPayload {
  projectId: number;
  rows: GenerateSampleTaskRow[];
}

export interface SampleTaskQuery {
  projectId?: number;
  status?: TaskStatus;
  keyword?: string;
}

export interface BindPayload {
  labelCode: string;
  animalNo: string;
}

export interface VerifyPayload {
  labelCode: string;
  projectCode: string;
  animalNo: string;
  timePoint: string;
}

export interface RecordPayload {
  labelCode: string;
  resultNote?: string;
}

export function fetchSampleTasks(query: SampleTaskQuery = {}): Promise<SampleTask[]> {
  const params = new URLSearchParams();
  if (query.projectId) params.set('projectId', String(query.projectId));
  if (query.status) params.set('status', query.status);
  if (query.keyword) params.set('keyword', query.keyword);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return http.get<SampleTask[]>(`/api/sample-tasks${suffix}`);
}

export function generateSampleTasks(payload: GenerateSampleTasksPayload): Promise<SampleTask[]> {
  return http.post<SampleTask[], GenerateSampleTasksPayload>('/api/sample-tasks/generate', payload);
}

export function bindSample(payload: BindPayload): Promise<ScanResult> {
  return http.post<ScanResult, BindPayload>('/api/scan/bind', payload);
}

export function verifySample(payload: VerifyPayload): Promise<ScanResult> {
  return http.post<ScanResult, VerifyPayload>('/api/scan/verify', payload);
}

export function recordSample(payload: RecordPayload): Promise<ScanResult> {
  return http.post<ScanResult, RecordPayload>('/api/scan/record', payload);
}

