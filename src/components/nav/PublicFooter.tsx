import Link from 'next/link';
import { GHOSTED_CONTENT } from '@/lib/ghosted-content';

export function PublicFooter({ hallHref }: { hallHref: string }) {
  return (
    <footer className="public-footer">
      <div className="public-footer__inner">
        <div className="public-footer__brand">
          <strong>Ghosted</strong>
          <span>Public layer for recruitment, dispatches, and the road into the Hall.</span>
        </div>
        <div className="public-footer__links">
          <Link href="/roster/">Roster</Link>
          <Link href="/news/">News</Link>
          <Link href="/media/">Media</Link>
          <Link href="/about/">About</Link>
          <a href={hallHref}>Enter the Hall</a>
          <a href={GHOSTED_CONTENT.links.discord} target="_blank" rel="noopener noreferrer">Discord</a>
        </div>
      </div>
    </footer>
  );
}
