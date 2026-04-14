import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export function PublicFooter({ hallHref }: { hallHref: string }) {
  return (
    <footer className="public-footer">
      <div className="public-footer__inner">
        <div className="public-footer__brand">
          <strong>Ghosted</strong>
          <span>Live clan proof, dispatches, stream nights, and the path into the Hall.</span>
        </div>
        <nav className="public-footer__links" aria-label="Public footer">
          <Link href="/roster/" className="public-footer__link">Roster</Link>
          <Link href="/news/" className="public-footer__link">Dispatches</Link>
          <Link href="/media/" className="public-footer__link">Media</Link>
          <Link href="/about/" className="public-footer__link">About</Link>
          <Link href="/privacy/" className="public-footer__link">Privacy</Link>
          <Link href="/terms/" className="public-footer__link">Terms</Link>
          <a href={hallHref} className="public-footer__link public-footer__link--accent">Enter the Hall</a>
          <a
            href={GHOSTED_CONTENT.links.discord}
            className="public-footer__link public-footer__link--accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join Discord
          </a>
        </nav>
      </div>
    </footer>
  );
}
