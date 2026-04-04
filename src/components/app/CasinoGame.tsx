'use client';
import { useEffect, useRef } from 'react';

export default function CasinoGame() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Dynamically import the casino game module (Pixi.js — client-only)
    import('@/casino/main').catch((err) => {
      console.error('Casino game failed to load:', err);
    });
  }, []);

  return (
    <div
      id="casino-root"
      style={{
        minHeight: '60vh',
        borderRadius: '1.35rem',
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(13,11,15,0.78)',
        overflow: 'hidden',
      }}
    />
  );
}
