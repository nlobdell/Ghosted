import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = url.searchParams.get('next') ?? '/hall/';
  const destination = new URL('/api/auth/signin/discord', url.origin);
  destination.searchParams.set('callbackUrl', new URL(nextPath, url.origin).toString());
  return NextResponse.redirect(destination);
}
