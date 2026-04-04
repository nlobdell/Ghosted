import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';

export const metadata: Metadata = {
  title: { template: '%s | Ghosted Admin', default: 'Admin' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-page app-shell">
      <AppHeader />
      {children}
    </div>
  );
}
