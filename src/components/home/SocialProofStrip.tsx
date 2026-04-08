import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export function SocialProofStrip() {
  return (
    <section className="home-proof">
      <article>
        <span>Discord roll call</span>
        <strong>{GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()}</strong>
        <p>A big enough Discord to feel active before you ever ask where the clan really hangs out.</p>
      </article>
      <article>
        <span>Voices live</span>
        <strong>{GHOSTED_CONTENT.discord.onlineCountApprox.toLocaleString()}</strong>
        <p>Proof that Ghosted is moving right now, not just living in old screenshots.</p>
      </article>
      <article>
        <span>Wise Old Man tracked</span>
        <strong>{GHOSTED_CONTENT.wom.memberCount.toLocaleString()}</strong>
        <p>Verified roster, visible standings, and competition pressure tied to real member progress.</p>
      </article>
    </section>
  );
}
