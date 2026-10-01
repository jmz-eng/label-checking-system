import { http } from './http';
import type { LoginResponse, UserProfile } from '../types';

export interface LoginPayload {
  username: string;
  password: string;
}

export function login(payload: LoginPayload): Promise<LoginResponse> {
  return http.post<LoginResponse, LoginPayload>('/api/auth/login', payload);
}

export function fetchMe(): Promise<UserProfile> {
  return http.get<UserProfile>('/api/auth/me');
}

