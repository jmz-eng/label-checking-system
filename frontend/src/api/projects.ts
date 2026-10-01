import { http } from './http';
import type { Project } from '../types';

export interface ProjectCreatePayload {
  projectCode: string;
  projectName: string;
  testArticle: string;
  sponsor?: string;
}

export function fetchProjects(keyword?: string): Promise<Project[]> {
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  return http.get<Project[]>(`/api/projects${query}`);
}

export function createProject(payload: ProjectCreatePayload): Promise<Project> {
  return http.post<Project, ProjectCreatePayload>('/api/projects', payload);
}

