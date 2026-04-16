import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LegacyTwitchPlatformPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const next = new URLSearchParams({ tab: 'setup' });
  if (typeof params.message === 'string' && params.message.trim()) {
    next.set('message', params.message);
  }
  redirect(`/v?${next.toString()}`);
}
