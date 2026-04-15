import 'server-only';

import {
  beginTwitchPlatformConnect,
  buildTwitchPlatformState,
  completeTwitchPlatformConnect,
  replayTwitchPlatformDelivery,
  syncTwitchPlatformSubscriptions,
  twitchEventProcessor,
  type TwitchModuleHandler,
} from '@/lib/server/twitch-platform';
import { buildLootChestGameState, twitchGiveawaysModuleHandler } from '@/lib/server/twitch-loot-chest';

const GHOSTED_TWITCH_HANDLERS: TwitchModuleHandler[] = [twitchGiveawaysModuleHandler];
type GhostedTwitchOperator = Parameters<typeof beginTwitchPlatformConnect>[0];

export function ghostedTwitchHandlers() {
  return GHOSTED_TWITCH_HANDLERS;
}

export async function buildGhostedTwitchPlatformState(actor: GhostedTwitchOperator) {
  return buildTwitchPlatformState(actor, GHOSTED_TWITCH_HANDLERS);
}

export async function beginGhostedTwitchPlatformConnect(
  actor: GhostedTwitchOperator,
  nextPath?: string | null,
) {
  return beginTwitchPlatformConnect(actor, nextPath);
}

export async function completeGhostedTwitchPlatformConnect(params: {
  code?: string | null;
  state?: string | null;
  actor: GhostedTwitchOperator;
}) {
  const result = await completeTwitchPlatformConnect(params);
  await syncTwitchPlatformSubscriptions(GHOSTED_TWITCH_HANDLERS);
  return {
    nextPath: result.nextPath,
    platformState: await buildTwitchPlatformState(params.actor, GHOSTED_TWITCH_HANDLERS),
    giveawayState: await buildLootChestGameState(params.actor),
  };
}

export async function syncGhostedTwitchPlatformSubscriptions() {
  return syncTwitchPlatformSubscriptions(GHOSTED_TWITCH_HANDLERS);
}

export async function handleGhostedTwitchPlatformWebhook(request: Request) {
  return twitchEventProcessor.handleWebhookRequest(request, GHOSTED_TWITCH_HANDLERS);
}

export async function replayGhostedTwitchDelivery(messageId: string) {
  return replayTwitchPlatformDelivery(messageId, GHOSTED_TWITCH_HANDLERS);
}
