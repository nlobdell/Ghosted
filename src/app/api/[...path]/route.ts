import { proxyPythonRequest } from '@/lib/server/python-proxy';

export const runtime = 'nodejs';

async function handle(request: Request, params: Promise<{ path: string[] }>) {
  const resolved = await params;
  const path = resolved.path.join('/');
  const url = new URL(request.url);
  const query = url.search || '';
  return proxyPythonRequest(request, `/api/${path}${query}`);
}

export async function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}

export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}

export async function PUT(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}

export async function PATCH(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}

export async function DELETE(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return handle(request, context.params);
}
