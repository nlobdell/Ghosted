import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function LegacyGiveawayOverlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/v/overlay?token=${encodeURIComponent(token)}`);
}
