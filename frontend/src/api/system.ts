import { http } from './http';
import type { AuditLog, Notice, Permission, Role, SystemUser } from '../types';

export interface PermissionSavePayload {
  permissionCode: string;
  permissionName: string;
  module: string;
}

export interface RoleSavePayload {
  roleCode: string;
  roleName: string;
  description?: string;
}

export interface NoticeSavePayload {
  title: string;
  content: string;
  noticeType?: string;
  publishStatus?: string;
}

export interface UserCreatePayload {
  username: string;
  password: string;
  realName: string;
  department?: string;
  status?: SystemUser['status'];
  roleIds: number[];
}

export interface UserUpdatePayload {
  realName: string;
  department?: string;
  status: SystemUser['status'];
  roleIds: number[];
}

export function fetchPermissions(keyword?: string): Promise<Permission[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<Permission[]>(`/api/system/permissions${query}`);
}

export function createPermission(payload: PermissionSavePayload): Promise<Permission> {
  return http.post<Permission, PermissionSavePayload>('/api/system/permissions', payload);
}

export function fetchRoles(): Promise<Role[]> {
  return http.get<Role[]>('/api/system/roles');
}

export function createRole(payload: RoleSavePayload): Promise<Role> {
  return http.post<Role, RoleSavePayload>('/api/system/roles', payload);
}

export function updateRolePermissions(roleId: number, permissionCodes: string[]): Promise<Role> {
  return http.put<Role, { permissionCodes: string[] }>(`/api/system/roles/${roleId}/permissions`, {
    permissionCodes,
  });
}

export function fetchUsers(keyword?: string): Promise<SystemUser[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<SystemUser[]>(`/api/system/users${query}`);
}

export function createUser(payload: UserCreatePayload): Promise<SystemUser> {
  return http.post<SystemUser, UserCreatePayload>('/api/system/users', payload);
}

export function updateUser(id: number, payload: UserUpdatePayload): Promise<SystemUser> {
  return http.put<SystemUser, UserUpdatePayload>(`/api/system/users/${id}`, payload);
}

export function resetUserPassword(id: number, newPassword: string): Promise<void> {
  return http.put<void, { newPassword: string }>(`/api/system/users/${id}/password`, { newPassword });
}

export function fetchSystemLogs(keyword?: string): Promise<AuditLog[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<AuditLog[]>(`/api/system/logs${query}`);
}

export function fetchNotices(keyword?: string): Promise<Notice[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<Notice[]>(`/api/system/notices${query}`);
}

export function fetchPublishedNotices(): Promise<Notice[]> {
  return http.get<Notice[]>('/api/notices');
}

export function createNotice(payload: NoticeSavePayload): Promise<Notice> {
  return http.post<Notice, NoticeSavePayload>('/api/system/notices', payload);
}

export function updateNotice(id: number, payload: NoticeSavePayload): Promise<Notice> {
  return http.put<Notice, NoticeSavePayload>(`/api/system/notices/${id}`, payload);
}

export function publishNotice(id: number): Promise<Notice> {
  return http.post<Notice, Record<string, never>>(`/api/system/notices/${id}/publish`, {});
}
