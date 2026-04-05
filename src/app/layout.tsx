import type { Metadata } from 'next';
import { DM_Sans, Space_Mono, Syne } from 'next/font/google';
import './globals.css';

const displayFont = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-ghosted-display',
});

const bodyFont = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ghosted-body',
});

const monoFont = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-ghosted-mono',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Ghosted Clan',
    default: 'Ghosted Clan | Welcome to the Hall',
  },
  description:
    'Ghosted is an Old School RuneScape clan community led by vghosted on Twitch, with a Discord-first event flow, rewards, giveaways, and a unified member hub.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
        <a className="site-skip-link" href="#main-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
