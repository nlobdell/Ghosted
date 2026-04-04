'use client';
import { useEffect, useRef } from 'react';

export default function CasinoGame() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Dynamically import the Pixi.js casino (client-only, mounts onto #casino-root)
    import('@/casino/main').catch((err) => {
      console.error('Casino game failed to load:', err);
    });
  }, []);

  // Styled via #casino-root in globals.css
  return <div id="casino-root" />;
}
