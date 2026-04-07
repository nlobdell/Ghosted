import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HallTopbar } from '@/components/nav/HallTopbar';
import { HallSidebar } from '@/components/nav/HallSidebar';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getServerJSON } from '@/lib/server-api';
import type { ShellData } from '@/lib/types';

export const metadata: Metadata = {
  title: { template: '%s | Ghosted Admin', default: 'Admin' },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.is_admin) {
    redirect('/hall/');
  }

  const shellData = await getServerJSON<ShellData>('/api/site-shell?next=%2Fadmin%2F');

  return (
    <div className="app-page app-shell">
      <HallTopbar shellData={shellData} />
      <div className="hall-layout">
        <HallSidebar includeAdmin />
        <div className="hall-main">
          {children}
        </div>
      </div>
    </div>
  );
}
