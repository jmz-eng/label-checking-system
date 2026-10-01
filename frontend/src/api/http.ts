import type { ApiResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';
const TOKEN_KEY = 'tag-management-token';
export const AUTH_UNAUTHORIZED_EVENT = 'tag-management:unauthorized';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const responseText = await response.text();
  if (!responseText) {
    throw new Error(response.ok ? '服务器未返回有效数据' : `请求失败（${response.status}）`);
  }
  try {
    return JSON.parse(responseText) as ApiResponse<T>;
  } catch {
    throw new Error(response.ok ? '服务器返回格式不正确' : `服务暂时不可用（${response.status}）`);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error('网络连接失败，请检查后端服务是否正常运行');
  }
  if (response.status === 401) {
    clearStoredToken();
    notifyUnauthorized();
  }
  const body = await parseResponse<T>(response);
  if (!response.ok || body.code !== 200) {
    throw new Error(body.message || '请求失败');
  }
  return body.data;
}

export const http = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T, B>(path: string, body: B): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  put<T, B>(path: string, body: B): Promise<T> {
    return request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },
};
