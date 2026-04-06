import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getConfiguredLoginHref } from '@/lib/auth/server-config';
import { buildPythonProxyRequest } from '@/lib/server/python-proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get('next') ?? '/';
  const loginHref = getConfiguredLoginHref(nextPath);
  const pythonResponse = await buildPythonProxyRequest(request, `/api/site-shell?next=${encodeURIComponent(nextPath)}`);
  const payload = await pythonResponse.json().catch(() => null) as Record<string, unknown> | null;
  const session = await auth();

  if (!payload) {
    return NextResponse.json(
      {
        authenticated: Boolean(session?.user),
        auth: {
          canSignIn: Boolean(loginHref),
          loginHref,
        },
      },
      { status: pythonResponse.status || 200 },
    );
  }

  const nextPayload = {
    ...payload,
    auth: {
      ...(typeof payload.auth === 'object' && payload.auth ? payload.auth : {}),
      canSignIn: Boolean(loginHref),
      loginHref,
    },
  };

  return NextResponse.json(nextPayload, { status: pythonResponse.status });
}
