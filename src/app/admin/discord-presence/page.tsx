import { redirect } from 'next/navigation';

export default function DiscordPresenceAdminRedirectPage() {
  redirect('/admin/systems?panel=discord-presence');
}
