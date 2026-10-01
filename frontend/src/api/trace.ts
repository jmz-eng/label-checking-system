import { http } from './http';
import type { AuditLog, ScanRecord } from '../types';

export function fetchScanRecords(labelCode?: string): Promise<ScanRecord[]> {
  const query = labelCode ? `?labelCode=${encodeURIComponent(labelCode)}` : '';
  return http.get<ScanRecord[]>(`/api/scan-records${query}`);
}

export function fetchAuditLogs(keyword?: string): Promise<AuditLog[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<AuditLog[]>(`/api/audit-logs${query}`);
}

