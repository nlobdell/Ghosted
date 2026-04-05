import type { Metadata } from 'next';
import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export const metadata: Metadata = {
  title: 'Terms of Use',
};

export default function TermsPage() {
  return (
    <main id="main-content" className="page-shell editorial-page">
      <section className="editorial-surface editorial-stack">
        <p className="kicker">Terms of Use</p>
        <h1>Ghosted access is for clan and community participation, not impersonation or abuse.</h1>
        <p className="editorial-copy">
          By using Ghosted, you agree to use the site lawfully, follow the Ghosted community rules, and respect the
          platform rules of any connected services, including Discord.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>Account access</h2>
        <p className="editorial-copy">
          Access to member features depends on a valid Discord sign-in and any community eligibility requirements
          enforced by Ghosted. We may suspend or remove access for abuse, fraud, automation misuse, harassment, or
          attempts to bypass site restrictions.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>Community data and content</h2>
        <p className="editorial-copy">
          You are responsible for the accuracy of content you submit to Ghosted. Do not upload unlawful, deceptive, or
          rights-violating content, and do not use Ghosted in ways that violate Discord&apos;s developer or platform
          rules.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>Availability</h2>
        <p className="editorial-copy">
          Ghosted may change or remove features at any time, including Hall access, rewards systems, and Ghostling
          features. The service is provided as-is for community use.
        </p>
      </section>

      <section className="editorial-surface editorial-stack">
        <h2>Support</h2>
        <p className="editorial-copy">
          If you need help with access or account issues, use the official Ghosted Discord server or the public site
          contact paths.
        </p>
        <div className="app-inline-actions">
          <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer" className="button">
            Open Discord
          </a>
          <Link href="/privacy/" className="button button--secondary">
            Privacy Policy
          </Link>
        </div>
      </section>
    </main>
  );
}
