import { http } from './http';
import type { AppMenu } from '../types';

export interface MenuSavePayload {
  parentId: number;
  menuKey: string;
  menuName: string;
  routePath?: string;
  component?: string;
  permissionCode?: string;
  icon?: string;
  sortOrder?: number;
  visible?: boolean;
  status?: string;
}

export function fetchMyMenus(): Promise<AppMenu[]> {
  return http.get<AppMenu[]>('/api/menus/routes');
}

export function fetchSystemMenus(): Promise<AppMenu[]> {
  return http.get<AppMenu[]>('/api/system/menus');
}

export function createMenu(payload: MenuSavePayload): Promise<AppMenu> {
  return http.post<AppMenu, MenuSavePayload>('/api/system/menus', payload);
}

export function updateMenu(id: number, payload: MenuSavePayload): Promise<AppMenu> {
  return http.put<AppMenu, MenuSavePayload>(`/api/system/menus/${id}`, payload);
}

