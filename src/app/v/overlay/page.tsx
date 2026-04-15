import { notFound } from 'next/navigation';
import { getGhostedBuildId } from '@/lib/server/app-build';
import { lootChestStateForOverlayToken } from '@/lib/server/twitch-loot-chest';
import TwitchLootChestOverlayClient from '../giveaways/overlay/TwitchLootChestOverlayClient';

export const dynamic = 'force-dynamic';

export default async function TwitchLootChestOverlayPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = String(params.token ?? '').trim();

  if (!token) {
    notFound();
  }

  const initialState = lootChestStateForOverlayToken(token);
  if (!initialState) {
    notFound();
  }
  const buildId = getGhostedBuildId();

  return (
    <>
      <style>{`
        html,
        body {
          background: transparent !important;
        }

        body::before,
        body::after {
          display: none !important;
        }
      `}</style>
      <TwitchLootChestOverlayClient initialState={initialState} overlayToken={token} buildId={buildId} />
    </>
  );
}
