import {API_URL} from 'config/api';
import type {RunView} from '@canvas/games-silk-road-tactics';

const KEY_STORAGE = 'canvas:playerKey';

export interface RunResponse {
  runId: string;
  game: string;
  status: 'active' | 'won' | 'lost' | 'abandoned';
  view: RunView;
}

/**
 * The anonymous player key (D4): a random secret made once and kept in
 * localStorage. It is only ever sent in the Authorization header. If
 * storage is blocked, a key lasts for this page load only.
 */
let memoryKey: string | null = null;
export function playerKey(): string {
  try {
    const saved = localStorage.getItem(KEY_STORAGE);
    if (saved) return saved;
  } catch {
    // storage blocked: fall through to a key for this page load
  }
  if (!memoryKey) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    memoryKey = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  try {
    localStorage.setItem(KEY_STORAGE, memoryKey);
  } catch {
    // the run won't survive a reload; play continues
  }
  return memoryKey;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${playerKey()}`,
      ...init.headers,
    },
  });
  const body = (await res.json().catch(() => null)) as {message?: string} | null;
  if (!res.ok) throw new Error(body?.message ?? `Server error: ${res.status}`);
  return body as T;
}

export const runsApi = {
  active: () => call<{activeRunId: string | null}>('/runs/active'),
  get: (runId: string) => call<RunResponse>(`/runs/${runId}`),
  start: () =>
    call<RunResponse>('/runs', {method: 'POST', body: JSON.stringify({game: 'silk-road-tactics'})}),
  deploy: (runId: string, body: unknown) =>
    call<RunResponse>(`/runs/${runId}/deploy`, {method: 'POST', body: JSON.stringify(body)}),
  turn: (runId: string, body: unknown) =>
    call<RunResponse>(`/runs/${runId}/turn`, {method: 'POST', body: JSON.stringify(body)}),
};
