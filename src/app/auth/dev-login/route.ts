import { NextResponse } from 'next/server';

const PYTHON_API_URL = (process.env.PYTHON_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

export const runtime = 'nodejs';

function filterHeaders(source: Headers) {
  const headers = new Headers();
  for (const [key, value] of source.entries()) {
    if (key.toLowerCase() === 'content-length') continue;
    headers.set(key, value);
  }
  return headers;
}

export async function GET(request: Request) {
  if (process.env.ENABLE_DEV_AUTH !== 'true') {
    return NextResponse.json({ error: 'Development auth is disabled.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const upstream = await fetch(`${PYTHON_API_URL}/auth/dev-login${url.search}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json,text/html,*/*',
    },
    redirect: 'manual',
    cache: 'no-store',
  });

  const location = upstream.headers.get('location') ?? url.searchParams.get('next') ?? '/hall/';
  const response = NextResponse.redirect(new URL(location, url.origin), upstream.status || 302);
  const headers = filterHeaders(upstream.headers);

  const setCookie = headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}
