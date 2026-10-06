import type { ApiResponse } from '../types';
import { humanizeApiMessage } from '../utils/apiMessage';

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

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(humanizeApiMessage(message));
  }
  get uncertain(): boolean {
    return this.status === 0 || this.status >= 500;
  }
}

function notifyUnauthorized(): void {
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

async function parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const responseText = await response.text();
  if (!responseText) {
    throw new ApiError(
      response.ok ? '服务器未返回有效数据' : `请求失败（${response.status}）`,
      response.ok ? 0 : response.status,
    );
  }
  try {
    return JSON.parse(responseText) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      response.ok ? '服务器返回格式不正确' : `服务暂时不可用（${response.status}）`,
      response.ok ? 0 : response.status,
    );
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
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
    throw new ApiError('网络连接失败，请检查后端服务是否正常运行');
  }
  if (response.status === 401) {
    clearStoredToken();
    notifyUnauthorized();
  }
  const body = await parseResponse<T>(response);
  if (!response.ok || body.code !== 200) {
    throw new ApiError(body.message || '请求失败', response.status);
  }
  return body.data;
}

export const http = {
  multipart<T>(path: string, body: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
  async download(path: string, fallbackName: string): Promise<void> {
    const token = getStoredToken();
    const response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (response.status === 401) {
      clearStoredToken();
      notifyUnauthorized();
    }
    if (!response.ok) {
      const body = await parseResponse<unknown>(response);
      throw new ApiError(body.message || '下载失败', response.status);
    }
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const plain = disposition.match(/filename=\"?([^\";]+)/i)?.[1];
    let filename = plain || fallbackName;
    if (encoded) {
      try {
        filename = decodeURIComponent(encoded);
      } catch {
        filename = fallbackName;
      }
    }
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
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
