import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HallTopbar } from '@/components/nav/HallTopbar';
import { HallSidebar } from '@/components/nav/HallSidebar';
import { getCurrentUser } from '@/lib/server/ghosted-api';
import { getServerJSON } from '@/lib/server-api';
import type { ShellData } from '@/lib/types';

export const metadata: Metadata = {
  title: { template: '%s | Ghosted Admin', default: 'Ghosted Admin' },
};

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.is_admin) {
    redirect('/hall/');
  }

  const shellData = await getServerJSON<ShellData>('/api/site-shell?next=%2Fadmin%2F');

  return (
    <div className="app-page app-shell app-shell--admin">
      <HallTopbar shellData={shellData} surface="admin" />
      <div className="hall-layout hall-layout--admin">
        <HallSidebar includeAdmin surface="admin" />
        <div className="hall-main hall-main--admin" aria-label="Admin workspace">
          {children}
        </div>
      </div>
    </div>
  );
}
