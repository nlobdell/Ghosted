import 'server-only';

import { NextResponse } from 'next/server';

export class AppError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

export function envText(name: string) {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (
    trimmed.length >= 2
    && trimmed[0] === trimmed[trimmed.length - 1]
    && (trimmed[0] === '\'' || trimmed[0] === '"')
  ) {
    return trimmed.slice(1, -1).trim() || undefined;
  }
  return trimmed;
}

export function envFlag(name: string, defaultValue = false) {
  const value = envText(name);
  if (value === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function envInt(name: string, defaultValue: number) {
  const value = envText(name);
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function utcNow() {
  return new Date();
}

export function utcIso(value?: Date | string | null) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return utcNow().toISOString();
}

export function parseIso(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.replace('Z', '+00:00');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function jsonLoad<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function slugify(value: string) {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

export function humanizeIdentifier(value: unknown) {
  const text = String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ');
  if (!text) return '';
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeLocalPath(path: string | null | undefined) {
  const normalized = String(path ?? '/').trim() || '/';
  return normalized.startsWith('/') ? normalized : '/';
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  console.error(error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function withRouteErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response> | Response,
) {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return routeErrorResponse(error);
    }
  };
}

export async function readJsonBody<T extends Record<string, unknown>>(request: Request) {
  try {
    return await request.json() as T;
  } catch {
    throw new AppError('Request body must be valid JSON.', 400);
  }
}
