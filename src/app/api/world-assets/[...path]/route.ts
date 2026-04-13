import fs from 'node:fs';
import { AppError, withRouteErrorHandling } from '@/lib/server/core';
import {
  worldAssetMimeType,
  worldAssetPath,
} from '@/lib/server/scene-worlds';

export const runtime = 'nodejs';

export const GET = withRouteErrorHandling(async (
  _request: Request,
  context: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await context.params;
  const relativePath = path.join('/');
  const target = worldAssetPath(relativePath);

  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    throw new AppError('World asset not found.', 404);
  }

  const body = fs.readFileSync(target);
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': worldAssetMimeType(relativePath),
      'Content-Length': String(body.byteLength),
      'Cache-Control': 'no-store',
    },
  });
});
