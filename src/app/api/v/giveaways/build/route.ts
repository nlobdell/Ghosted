import { NextResponse } from 'next/server';
import { getGhostedBuildId } from '@/lib/server/app-build';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { buildId: getGhostedBuildId() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
