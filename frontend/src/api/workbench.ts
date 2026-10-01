import { http } from './http';
import type { WorkbenchSummary } from '../types';

export function fetchWorkbenchSummary(): Promise<WorkbenchSummary> {
  return http.get<WorkbenchSummary>('/api/workbench/summary');
}
