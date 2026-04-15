import { notFound } from 'next/navigation';
import { lootChestStateForOverlayToken } from '@/lib/server/twitch-loot-chest';
import TwitchLootChestOverlayClient from '../TwitchLootChestOverlayClient';

export const dynamic = 'force-dynamic';

export default async function TwitchLootChestOverlayPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const initialState = lootChestStateForOverlayToken(token);
  if (!initialState) {
    notFound();
  }

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
      <TwitchLootChestOverlayClient initialState={initialState} overlayToken={token} />
    </>
  );
}
