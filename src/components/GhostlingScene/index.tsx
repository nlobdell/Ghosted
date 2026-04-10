'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './GhostlingScene.module.css';

type PresenceMember = {
  userId: number | null;
  username: string;
};

type GhostlingEntity = {
  username: string;
  imgSrc: string;
  // Physics — mutated directly in the rAF loop, never via setState
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;       // px / sec
  pausing: boolean;
  pauseRemaining: number; // ms
  facingLeft: boolean;
  opacity: number;
  removing: boolean;
};

const GHOST_SIZE = 56;
const PADDING = GHOST_SIZE;
const SPEED_MIN = 30;
const SPEED_MAX = 50;
const PAUSE_MIN_MS = 2_000;
const PAUSE_MAX_MS = 4_000;
const FADE_MS = 1_000;
const POLL_MS = 60_000;
const DEFAULT_SRC = '/api/companion/render-animated';

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function imgSrc(userId: number | null) {
  return userId !== null ? `/api/companion/render-animated?user=${userId}` : DEFAULT_SRC;
}

function randomTarget(w: number, h: number) {
  return {
    x: rand(PADDING, Math.max(PADDING + 1, w - PADDING - GHOST_SIZE)),
    y: rand(PADDING, Math.max(PADDING + 1, h - PADDING - GHOST_SIZE)),
  };
}

function makeEntity(member: PresenceMember, w: number, h: number): GhostlingEntity {
  const safeW = Math.max(w, PADDING * 2 + GHOST_SIZE + 1);
  const safeH = Math.max(h, PADDING * 2 + GHOST_SIZE + 1);
  const target = randomTarget(safeW, safeH);
  return {
    username: member.username,
    imgSrc: imgSrc(member.userId),
    x: rand(PADDING, safeW - PADDING - GHOST_SIZE),
    y: rand(PADDING, safeH - PADDING - GHOST_SIZE),
    targetX: target.x,
    targetY: target.y,
    speed: rand(SPEED_MIN, SPEED_MAX),
    pausing: false,
    pauseRemaining: 0,
    facingLeft: Math.random() < 0.5,
    opacity: 0,
    removing: false,
  };
}

const HOUSE_KEY = '__house__';

export function GhostlingScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const entitiesRef = useRef<Map<string, GhostlingEntity>>(new Map());
  const wrapRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const imgRefs = useRef<Map<string, HTMLImageElement | null>>(new Map());
  const frameRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const reducedMotion = useRef(false);

  // Only drives DOM additions / removals — not per-frame updates
  const [memberKeys, setMemberKeys] = useState<string[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const containerSize = useCallback(() => {
    const el = containerRef.current;
    return {
      w: el && el.clientWidth > 0 ? el.clientWidth : 800,
      h: el && el.clientHeight > 0 ? el.clientHeight : 220,
    };
  }, []);

  const syncMembers = useCallback((incoming: PresenceMember[]) => {
    const { w, h } = containerSize();
    const entities = entitiesRef.current;

    const effective: PresenceMember[] =
      incoming.length > 0 ? incoming : [{ userId: null, username: HOUSE_KEY }];

    const incomingKeys = new Set(effective.map((m) => m.username));

    // Mark departing entities for fade-out
    for (const [key, entity] of entities) {
      if (!incomingKeys.has(key) && !entity.removing) {
        entity.removing = true;
      }
    }

    // Add newly arrived entities (start faded out)
    for (const member of effective) {
      if (!entities.has(member.username)) {
        entities.set(member.username, makeEntity(member, w, h));
      }
    }

    setMemberKeys(Array.from(entities.keys()));
  }, [containerSize]);

  const fetchPresence = useCallback(async () => {
    try {
      const res = await fetch('/api/scene/presence');
      if (!res.ok) { syncMembers([]); return; }
      const data = await res.json() as { members: PresenceMember[] };
      syncMembers(Array.isArray(data.members) ? data.members : []);
    } catch {
      syncMembers([]);
    }
  }, [syncMembers]);

  useEffect(() => {
    // Detect reduced-motion preference
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotion.current = mq.matches;
    const onMqChange = () => { reducedMotion.current = mq.matches; };
    mq.addEventListener('change', onMqChange);

    const entities = entitiesRef.current;
    const wrapMap = wrapRefs.current;
    const imgMap = imgRefs.current;

    const loop = (ts: number) => {
      // Pause when tab is hidden
      if (document.visibilityState === 'hidden') {
        lastTsRef.current = 0;
        frameRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = lastTsRef.current > 0 ? Math.min(ts - lastTsRef.current, 100) : 16;
      lastTsRef.current = ts;

      const { w, h } = containerSize();
      const keysToRemove: string[] = [];
      const active: GhostlingEntity[] = [];

      for (const entity of entities.values()) {
        const wrapEl = wrapMap.get(entity.username) ?? null;
        const imgEl = imgMap.get(entity.username) ?? null;

        // Fade out departing entities
        if (entity.removing) {
          entity.opacity = Math.max(0, entity.opacity - dt / FADE_MS);
          if (wrapEl) wrapEl.style.opacity = entity.opacity.toFixed(3);
          if (entity.opacity <= 0) keysToRemove.push(entity.username);
          continue;
        }

        active.push(entity);

        // Fade in new entities
        if (entity.opacity < 1) {
          entity.opacity = Math.min(1, entity.opacity + dt / FADE_MS);
          if (wrapEl) wrapEl.style.opacity = entity.opacity.toFixed(3);
        }

        if (reducedMotion.current) continue;

        // Wandering physics
        if (entity.pausing) {
          entity.pauseRemaining -= dt;
          if (entity.pauseRemaining <= 0) {
            entity.pausing = false;
            const t = randomTarget(w, h);
            entity.targetX = t.x;
            entity.targetY = t.y;
            entity.speed = rand(SPEED_MIN, SPEED_MAX);
          }
        } else {
          const dx = entity.targetX - entity.x;
          const dy = entity.targetY - entity.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const step = entity.speed * (dt / 1000);

          if (dist <= step || dist === 0) {
            entity.x = entity.targetX;
            entity.y = entity.targetY;
            entity.pausing = true;
            entity.pauseRemaining = rand(PAUSE_MIN_MS, PAUSE_MAX_MS);
          } else {
            entity.x += (dx / dist) * step;
            entity.y += (dy / dist) * step;
            entity.facingLeft = dx < 0;
          }

          // Clamp to stage bounds
          const maxX = w - PADDING - GHOST_SIZE;
          const maxY = h - PADDING - GHOST_SIZE;
          entity.x = Math.max(PADDING, Math.min(maxX > PADDING ? maxX : PADDING, entity.x));
          entity.y = Math.max(PADDING, Math.min(maxY > PADDING ? maxY : PADDING, entity.y));
        }

        // Apply position directly to DOM
        if (wrapEl) {
          wrapEl.style.transform = `translate(${Math.round(entity.x)}px, ${Math.round(entity.y)}px)`;
        }
        if (imgEl) {
          imgEl.style.transform = entity.facingLeft ? 'scaleX(-1)' : '';
        }
      }

      // Z-order: higher Y renders in front
      active
        .slice()
        .sort((a, b) => a.y - b.y)
        .forEach((e, i) => {
          const wrapEl = wrapMap.get(e.username) ?? null;
          if (wrapEl) wrapEl.style.zIndex = String(i + 1);
        });

      // Clean up fully-faded entities
      if (keysToRemove.length > 0) {
        for (const key of keysToRemove) {
          entities.delete(key);
        }
        setMemberKeys(Array.from(entities.keys()));
      }

      frameRef.current = requestAnimationFrame(loop);
    };

    frameRef.current = requestAnimationFrame(loop);

    void fetchPresence();
    const pollId = setInterval(() => { void fetchPresence(); }, POLL_MS);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearInterval(pollId);
      mq.removeEventListener('change', onMqChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className={styles.sceneSection}>
      <span className={styles.sceneLabel} aria-hidden="true">In the halls</span>
      <div
        ref={containerRef}
        className={`${styles.sceneStage}${reducedMotion.current ? ` ${styles.staticGrid}` : ''}`}
        aria-label="Ghostlings of members active in Discord voice"
        role="img"
      >
        {memberKeys.map((key) => {
          const entity = entitiesRef.current.get(key);
          if (!entity) return null;
          const isHouse = key === HOUSE_KEY;
          return (
            <div
              key={key}
              ref={(el) => { wrapRefs.current.set(key, el); }}
              className={styles.ghostWrap}
              style={{ opacity: 0 }}
              onMouseEnter={() => { if (!isHouse) setHoveredKey(key); }}
              onMouseLeave={() => setHoveredKey(null)}
              onTouchStart={() => {
                if (!isHouse) setHoveredKey((prev) => (prev === key ? null : key));
              }}
            >
              <img
                ref={(el) => { imgRefs.current.set(key, el); }}
                src={entity.imgSrc}
                alt={isHouse ? 'House Ghostling' : `${entity.username}'s Ghostling`}
                width={GHOST_SIZE}
                height={GHOST_SIZE}
                className={styles.ghostImg}
                loading="lazy"
              />
              {hoveredKey === key && (
                <span className={styles.ghostTooltip}>{entity.username}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
