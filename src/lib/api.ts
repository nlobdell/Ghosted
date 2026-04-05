const numberFormatter = new Intl.NumberFormat();
const shortFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
});

export async function getJSON<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    headers,
    ...options,
  });
  const payload = await res.json().catch(() => ({})) as { error?: string } & T;
  if (!res.ok) throw new Error((payload as { error?: string }).error ?? `Request failed: ${url}`);
  return payload as T;
}

export function formatPoints(value: number | undefined | null): string {
  return `${numberFormatter.format(Number(value ?? 0))} pts`;
}

export function formatPointsFull(value: number | undefined | null): string {
  return `${numberFormatter.format(Number(value ?? 0))} points`;
}

export function formatMaybeNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return shortFormatter.format(n);
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return 'Unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return dateFormatter.format(d);
}

export function formatMetricLabel(value: string): string {
  return (value || '').replaceAll('_', ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export function formatCompetitionWindow(entry: { startsAt?: string; endsAt?: string }): string {
  return `${formatDate(entry.startsAt ?? null)} to ${formatDate(entry.endsAt ?? null)}`;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
