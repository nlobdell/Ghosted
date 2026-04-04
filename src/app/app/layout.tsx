import type { Metadata } from 'next';
import { GhostedNav } from '@/components/GhostedNav';

export const metadata: Metadata = {
  title: {
    template: '%s | Ghosted App',
    default: 'Ghosted App',
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-page app-shell">
      <GhostedNav sticky />
      {children}
    </div>
  );
}
