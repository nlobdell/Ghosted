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

export async function buildPythonProxyRequest(request: Request, pathWithQuery: string) {
  const session = await auth();
  const headers = new Headers();
  headers.set('Accept', request.headers.get('accept') ?? '*/*');

  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  const cookie = request.headers.get('cookie');
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
