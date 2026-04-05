import type { Metadata } from 'next';
import { HallTopbar } from '@/components/nav/HallTopbar';
import { HallSidebar } from '@/components/nav/HallSidebar';
import { getServerJSON } from '@/lib/server-api';
import type { ShellData } from '@/lib/types';

export const metadata: Metadata = {
  title: {
    template: '%s | Ghosted Hall',
    default: 'Ghosted Hall',
  },
};

export default async function HallLayout({ children }: { children: React.ReactNode }) {
  const shellData = await getServerJSON<ShellData>('/api/site-shell?next=%2Fhall%2F');

  return (
    <div className="app-page app-shell">
      <HallTopbar shellData={shellData} />
      <div className="hall-layout">
        <HallSidebar />
        <div className="hall-main">
          {children}
        </div>
      </div>
    </div>
  );
}
