import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle, CheckCheck, CheckCircle2, Info, XCircle } from 'lucide-react';
import { errorMessage, get, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Notifikasi } from '@/lib/types';
import { DataState, PageHeader, Pagination } from '@/components/ui';
import { NOTIF_CHANGED } from '@/components/NotifikasiBell';

interface NotifPage {
  items: Notifikasi[];
  unread: number;
  pagination: { page: number; totalPages: number };
}

const ICON = {
  INFO: [Info, 'text-sky-400'],
  SUCCESS: [CheckCircle2, 'text-emerald-400'],
  WARNING: [AlertTriangle, 'text-amber-400'],
  ERROR: [XCircle, 'text-rose-400'],
} as const;

const waktu = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function NotifikasiPage() {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const list = useFetch(() => get<NotifPage>('/notifikasi', { page, limit: 20, unread: unreadOnly || undefined }), [page, unreadOnly]);

  const changed = () => {
    list.reload();
    window.dispatchEvent(new Event(NOTIF_CHANGED));
  };

  const baca = async (n: Notifikasi) => {
    if (n.isRead) return;
    try {
      await put(`/notifikasi/${n.id}/baca`);
      changed();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const bacaSemua = async () => {
    try {
      toast.success((await put('/notifikasi/baca-semua')).message);
      changed();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Notifikasi"
        subtitle={list.data ? `${list.data.unread} belum dibaca` : undefined}
        actions={
          <button className="btn-ghost" onClick={bacaSemua} disabled={!list.data?.unread}>
            <CheckCheck className="h-4 w-4" /> Tandai semua dibaca
          </button>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          checked={unreadOnly}
          onChange={(e) => {
            setUnreadOnly(e.target.checked);
            setPage(1);
          }}
        />
        Hanya yang belum dibaca
      </label>
      <section className="card">
        <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.items.length} emptyText="Tidak ada notifikasi">
          <ul className="divide-y divide-slate-800">
            {list.data?.items.map((n) => {
              const [Icon, color] = ICON[n.tipe];
              return (
                <li key={n.id}>
                  <button
                    onClick={() => baca(n)}
                    className={`flex w-full gap-3 px-5 py-4 text-left transition-colors ${n.isRead ? '' : 'bg-primary-500/5 hover:bg-primary-500/10'}`}
                  >
                    <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${color}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm ${n.isRead ? 'text-slate-300' : 'font-semibold text-white'}`}>{n.judul}</p>
                      <p className="mt-0.5 text-sm text-slate-400">{n.pesan}</p>
                      <p className="mt-1 text-xs text-slate-500">{waktu(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="Belum dibaca" />}
                  </button>
                </li>
              );
            })}
          </ul>
          {list.data && <Pagination page={page} totalPages={list.data.pagination.totalPages} onChange={setPage} />}
        </DataState>
      </section>
    </>
  );
}
