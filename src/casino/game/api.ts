import type { ApiConfig, GamesPayload, MePayload, RewardsPayload, SpinApiPayload } from './types';

async function getJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((payload as { error?: string }).error || `Request failed for ${url}`);
  }
  return payload as T;
}

export function fetchConfig() {
  return getJSON<ApiConfig>('/api/config');
}

export function fetchMe() {
  return getJSON<MePayload>('/api/me');
}

export function fetchGames() {
  return getJSON<GamesPayload>('/api/casino/games');
}

export function fetchRewards() {
  return getJSON<RewardsPayload>('/api/rewards');
}

export function spinGame(gameSlug: string) {
  return getJSON<SpinApiPayload>('/api/casino/spin', {
    method: 'POST',
    body: JSON.stringify({ gameSlug }),
  });
}

export function logout() {
  return getJSON('/auth/logout', { method: 'POST' });
}
