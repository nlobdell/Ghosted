import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/auth';

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

function filteredHeaders(source: Headers) {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === 'content-length') continue;
    if (key.toLowerCase() === 'transfer-encoding') continue;
    headers.set(key, value);
  }
  return headers;
}

async function buildPythonRequestHeaders({
  accept,
  contentType,
  cookie,
}: {
  accept?: string | null;
  contentType?: string | null;
  cookie?: string | null;
}) {
  const session = await auth();
  const headers = new Headers();
  headers.set('Accept', accept ?? '*/*');

  if (contentType) headers.set('Content-Type', contentType);
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  const internalSecret = process.env.INTERNAL_API_SECRET?.trim();
  const userId = session?.user && 'id' in session.user ? String(session.user.id ?? '') : '';
  const discordId = session?.user && 'discordId' in session.user ? String(session.user.discordId ?? '') : '';

  if (internalSecret && userId) {
    headers.set('X-Ghosted-Internal-Secret', internalSecret);
    headers.set('X-Ghosted-User-Id', userId);
    if (discordId) {
      headers.set('X-Ghosted-User-Discord-Id', discordId);
    }
  }

  return headers;
}

export async function buildPythonProxyRequest(request: Request, pathWithQuery: string) {
  const headers = await buildPythonRequestHeaders({
    accept: request.headers.get('accept'),
    contentType: request.headers.get('content-type'),
    cookie: request.headers.get('cookie'),
  });

  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  return fetch(`${PYTHON_API_URL}${pathWithQuery}`, {
    method,
    headers,
    body,
    redirect: 'manual',
    cache: 'no-store',
  });
}

export async function proxyPythonRequest(request: Request, pathWithQuery: string) {
  const response = await buildPythonProxyRequest(request, pathWithQuery);
  return new Response(response.body, {
    status: response.status,
    headers: filteredHeaders(response.headers),
  });
}

export async function getPythonJSON<T>(pathWithQuery: string): Promise<{
  ok: boolean;
  status: number;
  data: T | null;
}> {
  const headerStore = await nextHeaders();
  const response = await fetch(`${PYTHON_API_URL}${pathWithQuery}`, {
    method: 'GET',
    headers: await buildPythonRequestHeaders({
      accept: 'application/json',
      cookie: headerStore.get('cookie'),
    }),
    redirect: 'manual',
    cache: 'no-store',
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => null) as T | null,
  };
}
