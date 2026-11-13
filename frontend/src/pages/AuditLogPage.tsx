import { Fragment, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { get } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { AuditLog } from '@/lib/types';
import { DataState, PageHeader, Pagination } from '@/components/ui';

interface AuditPage {
  items: AuditLog[];
  tabel: string[];
  pagination: { page: number; totalPages: number; total: number };
}

const AKSI_COLOR: Record<string, string> = {
  CREATE: 'text-emerald-400',
  UPDATE: 'text-sky-400',
  DELETE: 'text-rose-400',
};

const waktu = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' });

export default function AuditLogPage() {
  const [tabel, setTabel] = useState('');
  const [username, setUsername] = useState('');
  const [user, setUser] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setUser(username.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [username]);

  const list = useFetch(() => get<AuditPage>('/audit-log', { tabel, username: user, page, limit: 30 }), [tabel, user, page]);

  return (
    <>
      <PageHeader title="Audit Log" subtitle={list.data ? `${list.data.pagination.total} aktivitas perubahan data tercatat` : 'Riwayat perubahan data'} />
      <section className="card">
        <div className="flex flex-wrap gap-2 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Cari username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <select
            className="input w-auto"
            aria-label="Modul"
            value={tabel}
            onChange={(e) => {
              setTabel(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua modul</option>
            {list.data?.tabel.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.items.length} emptyText="Belum ada aktivitas">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Waktu</th>
                  <th>Pengguna</th>
                  <th>Aksi</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.items.map((a) => {
                  const [jenis, ...rest] = a.aksi.split(' ');
                  return (
                    <Fragment key={a.id}>
                      <tr className={a.dataBaru ? 'cursor-pointer hover:bg-slate-800/40' : ''} onClick={() => a.dataBaru && setOpen(open === a.id ? null : a.id)}>
                        <td className="whitespace-nowrap text-slate-400">{waktu(a.createdAt)}</td>
                        <td>
                          <p className="text-white">{a.username ?? '–'}</p>
                          {a.role && <p className="text-xs text-slate-500">{a.role}</p>}
                        </td>
                        <td>
                          <span className={`font-semibold ${AKSI_COLOR[jenis] ?? ''}`}>{jenis}</span>{' '}
                          <span className="font-mono text-xs text-slate-300">{rest.join(' ')}</span>
                        </td>
                        <td className="font-mono text-xs text-slate-500">{a.ipAddress ?? '–'}</td>
                      </tr>
                      {open === a.id && (
                        <tr>
                          <td colSpan={4} className="bg-slate-900/40">
                            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-300">{JSON.stringify(a.dataBaru, null, 2)}</pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {list.data && <Pagination page={page} totalPages={list.data.pagination.totalPages} onChange={setPage} />}
        </DataState>
      </section>
    </>
  );
}
