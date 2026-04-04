import type { Metadata } from 'next';
import { AppHeader } from '@/components/app/AppHeader';

export const metadata: Metadata = {
  title: {
    template: '%s | Ghosted App',
    default: 'Ghosted App',
  },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-page" style={{ minHeight: '100vh' }}>
      <AppHeader />
      {children}
    </div>
  );
}
