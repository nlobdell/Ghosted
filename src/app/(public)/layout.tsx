import { PublicFooter } from '@/components/nav/PublicFooter';
import { PublicNav } from '@/components/nav/PublicNav';
import { getServerJSON } from '@/lib/server-api';
import type { ShellData } from '@/lib/types';

function getHallHref(shellData: ShellData | null) {
  if (shellData?.authenticated) return '/hall/';
  return shellData?.auth?.loginHref ?? '/auth/login?next=%2Fhall%2F';
}

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const shellData = await getServerJSON<ShellData>('/api/site-shell?next=%2Fhall%2F');
  const hallHref = getHallHref(shellData);

  return (
    <div className="public-shell">
      <PublicNav hallHref={hallHref} />
      {children}
      <PublicFooter hallHref={hallHref} />
    </div>
  );
}
