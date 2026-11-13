import { useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  PenSquare,
  ScrollText,
  UserCog,
  Users,
  X,
  UserCheck,
  Wallet,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/auth/AuthContext';
import type { Role } from '@/lib/types';
import { Spinner } from './ui';

interface NavItem {
  to: string;
  label: string;
  icon: typeof BookOpen;
  roles: Role[];
}

export const NAV: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'DOSEN', 'MAHASISWA'] },
  { to: '/app/krs', label: 'KRS', icon: ClipboardList, roles: ['MAHASISWA'] },
  { to: '/app/khs', label: 'KHS', icon: FileText, roles: ['MAHASISWA'] },
  { to: '/app/transkrip', label: 'Transkrip', icon: ScrollText, roles: ['MAHASISWA'] },
  { to: '/app/nilai', label: 'Input Nilai', icon: PenSquare, roles: ['DOSEN', 'ADMIN'] },
  { to: '/app/absensi', label: 'Absensi', icon: UserCheck, roles: ['ADMIN', 'DOSEN', 'MAHASISWA'] },
  { to: '/app/tagihan', label: 'Tagihan', icon: Wallet, roles: ['ADMIN', 'MAHASISWA'] },
  { to: '/app/jadwal', label: 'Jadwal Kuliah', icon: CalendarDays, roles: ['ADMIN', 'DOSEN', 'MAHASISWA'] },
  { to: '/app/matakuliah', label: 'Mata Kuliah', icon: BookOpen, roles: ['ADMIN'] },
  { to: '/app/mahasiswa', label: 'Mahasiswa', icon: Users, roles: ['ADMIN'] },
  { to: '/app/dosen', label: 'Dosen', icon: UserCog, roles: ['ADMIN'] },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: 'Administrator', DOSEN: 'Dosen', MAHASISWA: 'Mahasiswa' };

/** Redirects to /login when signed out, and to the dashboard when the role is not allowed. */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 gap-2">
        <Spinner /> Memuat sesi…
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-5 h-16 text-primary-500">
        <GraduationCap className="h-7 w-7" />
        <span className="text-lg font-bold text-white tracking-tight">SIAKAD</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/app'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-primary-500/15 text-primary-500' : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              )
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-slate-800 p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-primary-500/20 text-primary-500 grid place-items-center font-semibold uppercase">
          {user.username.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{user.username}</p>
          <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
        </div>
        <button onClick={logout} className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10" title="Keluar" aria-label="Keluar">
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden lg:block sticky top-0 h-screen bg-dark-900/80 border-r border-slate-800 no-print">{sidebar}</aside>

      {/* Mobile top bar + drawer */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between h-14 px-4 bg-dark-900/90 backdrop-blur border-b border-slate-800 no-print">
        <div className="flex items-center gap-2 text-primary-500">
          <GraduationCap className="h-6 w-6" />
          <span className="font-bold text-white">SIAKAD</span>
        </div>
        <button onClick={() => setOpen(true)} className="p-2 text-slate-300" aria-label="Buka menu">
          <Menu className="h-6 w-6" />
        </button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 no-print">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-dark-900 border-r border-slate-800">
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 p-1 text-slate-400" aria-label="Tutup menu">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8 max-w-7xl w-full">
        <Outlet />
      </main>
    </div>
  );
}
