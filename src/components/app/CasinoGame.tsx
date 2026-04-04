'use client';
import { useEffect, useRef } from 'react';

export default function CasinoGame() {
  const mounted = useRef(false);

  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    // Dynamically import the Pixi.js casino.
    // main.ts populates [data-banner], [data-summary], and [data-content]
    // after booting — those elements must exist in the DOM first.
    import('@/casino/main').catch((err) => {
      console.error('Casino game failed to load:', err);
    });
  }, []);

  return (
    <div id="casino-root">
      {/* Skeleton targets that casino/main.ts populates via document.querySelector */}
      <div className="app-banner-slot" data-banner />
      <section className="app-summary-grid" data-summary />
      <section className="app-workspace" data-content />
    </div>
  );
}
