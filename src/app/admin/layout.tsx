import type { Metadata } from 'next';
import { HallTopbar } from '@/components/nav/HallTopbar';
import { getServerJSON } from '@/lib/server-api';
import type { ShellData } from '@/lib/types';

export const metadata: Metadata = {
  title: { template: '%s | Ghosted Admin', default: 'Admin' },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const shellData = await getServerJSON<ShellData>('/api/site-shell?next=%2Fadmin%2F');

  return (
    <div className="app-page app-shell">
      <HallTopbar shellData={shellData} />
      {children}
    </div>
  );
}
