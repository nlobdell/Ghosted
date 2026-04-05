import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export function SocialProofStrip() {
  return (
    <section className="home-proof">
      <article>
        <span>Discord members</span>
        <strong>{GHOSTED_CONTENT.discord.memberCountApprox.toLocaleString()}</strong>
      </article>
      <article>
        <span>WOM tracked</span>
        <strong>{GHOSTED_CONTENT.wom.memberCount.toLocaleString()}</strong>
      </article>
      <article>
        <span>Competition signal</span>
        <strong>Clan Cup live</strong>
      </article>
    </section>
  );
}
