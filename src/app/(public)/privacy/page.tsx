import type { Metadata } from 'next';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export const metadata: Metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="page-shell editorial-page">
      <section className="editorial-surface editorial-stack">
        <p className="kicker">Privacy</p>
        <h1>How Ghosted uses Discord and Hall account data.</h1>
        <p className="editorial-copy">
          Ghosted uses Discord OAuth only to identify members, protect Hall access, and connect account state like
          points, Ghostling ownership, competition activity, and profile preferences. Ghosted is not affiliated with
          or endorsed by Discord.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>What we collect</h2>
        <p className="editorial-copy">
          When you sign in with Discord, Ghosted may store your Discord user ID, username, display name, avatar,
          server role-derived access flags, and the member data needed to operate the site.
        </p>
        <p className="editorial-copy">
          Ghosted also stores in-app data you create or earn, including rewards balance, Ghostling loadout state,
          activity history, and linked clan-related profile data.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>How we use it</h2>
        <p className="editorial-copy">
          We use Discord identity data to sign you in, protect member-only pages, personalize the Hall, determine
          eligible features, and support moderation or admin workflows.
        </p>
        <p className="editorial-copy">
          Ghosted does not sell your Discord account data. Data is used to operate the community site and related clan
          systems.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>Contact and support</h2>
        <p className="editorial-copy">
          For account questions, data concerns, or support, contact the Ghosted team through the official Discord
          server.
        </p>
        <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button button--secondary button--small">
          Open Discord support
        </a>
      </section>
    </main>
  );
}
