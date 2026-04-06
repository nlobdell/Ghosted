import { refreshWomData } from '@/lib/server/ghosted-admin';
import { withRouteErrorHandling } from '@/lib/server/core';

export const runtime = 'nodejs';

export const POST = withRouteErrorHandling(async (request: Request) => {
  return refreshWomData(request);
});
