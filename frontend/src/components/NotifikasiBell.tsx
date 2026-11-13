import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { get } from '@/lib/api';

export const NOTIF_CHANGED = 'siakad:notif-changed';
const POLL_MS = 60_000;

/** Ikon lonceng dengan jumlah notifikasi belum dibaca; diperbarui berkala, saat pindah halaman, dan saat ada perubahan. */
export default function NotifikasiBell({ onNavigate }: { onNavigate?: () => void }) {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      get<{ unread: number }>('/notifikasi', { limit: 1 })
        .then((r) => alive && setUnread(r.data.unread))
        .catch(() => {});
    load();
    const t = setInterval(load, POLL_MS);
    window.addEventListener(NOTIF_CHANGED, load);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(NOTIF_CHANGED, load);
    };
  }, [location.pathname]);

  return (
    <NavLink
      to="/app/notifikasi"
      onClick={onNavigate}
      className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70"
      title="Notifikasi"
      aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-[18px] text-white text-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </NavLink>
  );
}
