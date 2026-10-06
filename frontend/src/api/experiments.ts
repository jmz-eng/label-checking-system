import { http } from './http';
import type {
  Experiment,
  ExperimentEvent,
  ImportBatch,
  Mapping,
  Purpose,
  Session,
  Tube,
} from '../types/experiments';
export const experimentPath = (id: number) => `/api/experiments/${id}`;
export const experimentApi = {
  list: () => http.get<Experiment[]>('/api/experiments'),
  mappings: (id: number) => http.get<Mapping[]>(`${experimentPath(id)}/mappings`),
  purposes: (id: number) => http.get<Purpose[]>(`${experimentPath(id)}/purposes`),
  tubes: (id: number) => http.get<Tube[]>(`${experimentPath(id)}/tubes`),
  imports: (id: number) => http.get<ImportBatch[]>(`${experimentPath(id)}/imports`),
  batch: (id: number, batchId: string) =>
    http.get<ImportBatch>(`${experimentPath(id)}/imports/${batchId}`),
  currentSession: () =>
    http.get<Session | Record<string, never>>('/api/experiments/sessions/current'),
  session: (id: string) => http.get<Session>(`/api/experiments/sessions/${id}`),
  events: (id: number, changes: boolean, query: string) =>
    http.get<ExperimentEvent[]>(`${experimentPath(id)}/${changes ? 'changes' : 'records'}${query}`),
};
