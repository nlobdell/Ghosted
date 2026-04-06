import type { Metadata } from 'next';
import { HallTopbar } from '@/components/nav/HallTopbar';
import { HallSidebar } from '@/components/nav/HallSidebar';
import { getHallShellData } from '@/lib/server/hall-data';

export const metadata: Metadata = {
  title: {
    template: '%s | Ghosted Hall',
    default: 'Ghosted Hall',
  },
};

export default async function HallLayout({ children }: { children: React.ReactNode }) {
  const shellData = await getHallShellData('/hall/');

  return (
    <div className="app-page app-shell">
      <HallTopbar shellData={shellData} />
      <div className="hall-layout">
        <HallSidebar includeAdmin={Boolean(shellData?.user?.isAdmin)} />
        <div className="hall-main">
          {children}
        </div>
      </div>
    </div>
  );
}
