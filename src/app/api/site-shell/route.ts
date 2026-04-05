import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { buildPythonProxyRequest } from '@/lib/server/python-proxy';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get('next') ?? '/';
  const devAuthEnabled = process.env.ENABLE_DEV_AUTH === 'true';
  const pythonResponse = await buildPythonProxyRequest(request, `/api/site-shell?next=${encodeURIComponent(nextPath)}`);
  const payload = await pythonResponse.json().catch(() => null) as Record<string, unknown> | null;
  const session = await auth();

  if (!payload) {
    return NextResponse.json(
      {
        authenticated: Boolean(session?.user),
        auth: {
          canSignIn: true,
          loginHref: devAuthEnabled
            ? `/auth/dev-login?next=${encodeURIComponent(nextPath)}`
            : `/auth/login?next=${encodeURIComponent(nextPath)}`,
        },
      },
      { status: pythonResponse.status || 200 },
    );
  }

  const nextPayload = {
    ...payload,
    auth: {
      ...(typeof payload.auth === 'object' && payload.auth ? payload.auth : {}),
      canSignIn: true,
      loginHref: devAuthEnabled
        ? `/auth/dev-login?next=${encodeURIComponent(nextPath)}`
        : `/auth/login?next=${encodeURIComponent(nextPath)}`,
    },
  };

  return NextResponse.json(nextPayload, { status: pythonResponse.status });
}
