'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { resolveLootChestRealtimeClientUrl } from '@/lib/giveaway-realtime';
import type { LootChestRealtimeSocketMessage, LootChestSceneSnapshot } from '@/lib/types';

const FALLBACK_POLL_MS = 1500;
const SOCKET_RECONNECT_BASE_MS = 600;
const SOCKET_RECONNECT_MAX_MS = 4000;

type SceneCarrier = {
  scene: LootChestSceneSnapshot;
};

function sceneSortKey(scene: LootChestSceneSnapshot) {
  return Number.isFinite(scene.revision)
    ? scene.revision
    : Date.parse(scene.publishedAt) || 0;
}

function shouldApplySnapshot(current: LootChestSceneSnapshot | null, next: LootChestSceneSnapshot) {
  if (!current) return true;
  const currentKey = sceneSortKey(current);
  const nextKey = sceneSortKey(next);
  if (nextKey !== currentKey) {
    return nextKey > currentKey;
  }

  return Date.parse(next.publishedAt) > Date.parse(current.publishedAt);
}

export function useLootChestSceneTransport<TState extends SceneCarrier>({
  overlayToken,
  currentScene,
  fetchState,
  applyState,
  applyScene,
}: {
  overlayToken?: string | null;
  currentScene: LootChestSceneSnapshot;
  fetchState: () => Promise<TState>;
  applyState: (nextState: TState) => void;
  applyScene: (nextScene: LootChestSceneSnapshot) => void;
}) {
  const sceneRef = useRef(currentScene);

  useEffect(() => {
    sceneRef.current = currentScene;
  }, [currentScene]);

  const syncScene = useEffectEvent((nextScene: LootChestSceneSnapshot) => {
    if (!shouldApplySnapshot(sceneRef.current, nextScene)) {
      return;
    }
    sceneRef.current = nextScene;
    applyScene(nextScene);
  });

  const loadFallbackState = useEffectEvent(async () => {
    const nextState = await fetchState();
    sceneRef.current = nextState.scene;
    applyState(nextState);
  });

  useEffect(() => {
    let fallbackPollId = 0;
    let reconnectTimeoutId = 0;
    let socket: WebSocket | null = null;
    let reconnectAttempts = 0;
    let disposed = false;

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutId > 0) {
        window.clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = 0;
      }
    };

    const stopFallbackPolling = () => {
      if (fallbackPollId > 0) {
        window.clearInterval(fallbackPollId);
        fallbackPollId = 0;
      }
    };

    const startFallbackPolling = (immediate = false) => {
      if (fallbackPollId > 0) return;

      if (immediate) {
        void loadFallbackState();
      }

      fallbackPollId = window.setInterval(() => {
        void loadFallbackState();
      }, FALLBACK_POLL_MS);
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutId > 0 || disposed || document.visibilityState === 'hidden') {
        return;
      }

      const delayMs = Math.min(
        SOCKET_RECONNECT_MAX_MS,
        SOCKET_RECONNECT_BASE_MS * (2 ** reconnectAttempts),
      );
      reconnectAttempts += 1;
      reconnectTimeoutId = window.setTimeout(() => {
        reconnectTimeoutId = 0;
        connectSocket();
      }, delayMs);
    };

    const closeSocket = () => {
      if (!socket) return;
      const activeSocket = socket;
      socket = null;
      activeSocket.onopen = null;
      activeSocket.onmessage = null;
      activeSocket.onerror = null;
      activeSocket.onclose = null;

      if (
        activeSocket.readyState === window.WebSocket.OPEN
        || activeSocket.readyState === window.WebSocket.CONNECTING
      ) {
        activeSocket.close();
      }
    };

    const connectSocket = () => {
      if (disposed) return;
      if (!overlayToken) {
        startFallbackPolling(true);
        return;
      }
      if (typeof window.WebSocket !== 'function') {
        startFallbackPolling(true);
        return;
      }
      if (
        socket
        && (socket.readyState === window.WebSocket.OPEN || socket.readyState === window.WebSocket.CONNECTING)
      ) {
        return;
      }

      try {
        const nextSocket = new window.WebSocket(resolveLootChestRealtimeClientUrl(overlayToken, window.location));
        socket = nextSocket;

        nextSocket.onopen = () => {
          if (disposed || socket !== nextSocket) return;
          reconnectAttempts = 0;
          stopFallbackPolling();
        };

        nextSocket.onmessage = (event) => {
          if (disposed || socket !== nextSocket) return;

          try {
            const message = JSON.parse(String(event.data)) as LootChestRealtimeSocketMessage;
            if (message.type === 'loot-chest:snapshot') {
              stopFallbackPolling();
              syncScene(message.payload);
              return;
            }

            if (message.type === 'loot-chest:error' && message.retryable) {
              startFallbackPolling(false);
            }
          } catch {
            // Ignore malformed realtime payloads and wait for the next snapshot.
          }
        };

        nextSocket.onerror = () => {
          if (
            nextSocket.readyState === window.WebSocket.OPEN
            || nextSocket.readyState === window.WebSocket.CONNECTING
          ) {
            nextSocket.close();
          }
        };

        nextSocket.onclose = () => {
          if (socket === nextSocket) {
            socket = null;
          }
          if (disposed) return;
          startFallbackPolling(false);
          scheduleReconnect();
        };
      } catch {
        startFallbackPolling(true);
        scheduleReconnect();
      }
    };

    const syncVisibility = () => {
      if (document.visibilityState === 'hidden') return;
      clearReconnectTimeout();
      connectSocket();
      if (!socket || socket.readyState !== window.WebSocket.OPEN) {
        startFallbackPolling(false);
        void loadFallbackState();
      }
    };

    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    window.addEventListener('focus', syncVisibility);

    return () => {
      disposed = true;
      clearReconnectTimeout();
      stopFallbackPolling();
      document.removeEventListener('visibilitychange', syncVisibility);
      window.removeEventListener('focus', syncVisibility);
      closeSocket();
    };
  }, [overlayToken]);
}
