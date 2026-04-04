import type { Metadata } from 'next';
import { GhostedNav } from '@/components/GhostedNav';

export const metadata: Metadata = {
  title: { template: '%s | Ghosted Admin', default: 'Admin' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-page app-shell">
      <GhostedNav sticky />
      {children}
    </div>
  );
}
