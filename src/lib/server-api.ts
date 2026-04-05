import { headers } from 'next/headers';

type RequestContext = {
  origin: string;
  cookie: string;
};

async function getRequestContext(): Promise<RequestContext> {
  const headerStore = await headers();
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const host = headerStore.get('x-forwarded-host') ?? headerStore.get('host') ?? 'localhost:3000';

  return {
    origin: `${proto}://${host}`,
    cookie: headerStore.get('cookie') ?? '',
  };
}

export async function getServerJSON<T>(path: string): Promise<T | null> {
  try {
    const requestContext = await getRequestContext();
    const response = await fetch(`${requestContext.origin}${path}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(requestContext.cookie ? { Cookie: requestContext.cookie } : {}),
      },
    });

    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}
