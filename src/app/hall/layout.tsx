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
    <div className="app-page app-shell app-shell--hall">
      <HallTopbar shellData={shellData} surface="hall" />
      <div className="hall-layout hall-layout--hall">
        <HallSidebar includeAdmin={Boolean(shellData?.user?.isAdmin)} surface="hall" />
        <div className="hall-main hall-main--hall">
          {children}
        </div>
      </div>
    </div>
  );
}
