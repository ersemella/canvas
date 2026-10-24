import {API_URL} from 'config/api';
import type {RunResponse as AnyRunResponse} from '@canvas/engine/server';
import type {HeroId, RunView, TurnInput} from '@canvas/games-silk-road-run';

const KEY_STORAGE = 'canvas:playerKey';

/** What every `/runs` route answers for Silk Road Run (the Worker's own type, with its view). */
export type RunResponse = AnyRunResponse<RunView>;

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
  start: (party: HeroId[]) =>
    call<RunResponse>('/runs', {
      method: 'POST',
      body: JSON.stringify({game: 'silk-road-run', party}),
    }),
  turn: (runId: string, body: TurnInput) =>
    call<RunResponse>(`/runs/${runId}/turn`, {method: 'POST', body: JSON.stringify(body)}),
  /** The AI's turn that is due (`view.aiDue`): one a request, so each has its own CPU allowance. */
  continue: (runId: string) => call<RunResponse>(`/runs/${runId}/continue`, {method: 'POST'}),
  next: (runId: string) => call<RunResponse>(`/runs/${runId}/next`, {method: 'POST'}),
};
