import { useState } from 'react';
import toast from 'react-hot-toast';
import { Lock, Plus, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { del, errorMessage, get, post } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { hariLabel } from '@/lib/format';
import type { Krs, Penawaran } from '@/lib/types';
import { DataState, PageHeader, Spinner, useConfirm } from '@/components/ui';

export default function KrsPage() {
  const krs = useFetch(() => get<Krs>('/krs'), []);
  const penawaran = useFetch(() => get<Penawaran[]>('/krs/penawaran'), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const refresh = () => {
    krs.reload();
    penawaran.reload();
  };

  const ambil = async (j: Penawaran) => {
    setBusyId(j.id);
    try {
      const r = await post('/krs', { jadwalId: j.id });
      toast.success(r.message);
      refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const k = krs.data;
  const sisaSks = k ? k.maxSks - k.totalSks : 0;
  const diambilMk = new Set(k?.items.map((i) => i.kodeMk));

  return (
    <>
      <PageHeader
        title="Kartu Rencana Studi"
        subtitle={k ? `Periode ${k.periode.semester} ${k.periode.tahunAjaran}` : undefined}
      />

      <div className="grid gap-6 2xl:grid-cols-5">
        {/* KRS saya */}
        <section className="card 2xl:col-span-2 self-start">
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <h2 className="font-semibold text-white">KRS saya</h2>
            {k && (
              <span className={clsx('badge', k.totalSks > 0 ? 'bg-primary-500/15 text-primary-500' : 'bg-slate-700 text-slate-300')}>
                {k.totalSks} / {k.maxSks} SKS
              </span>
            )}
          </div>
          {k && (
            <div className="px-5 pb-3">
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={k.totalSks} aria-valuemax={k.maxSks} aria-label="SKS terpakai">
                <div className="h-full bg-primary-500 transition-all" style={{ width: `${Math.min(100, (k.totalSks / k.maxSks) * 100)}%` }} />
              </div>
            </div>
          )}
          <DataState loading={krs.loading} error={krs.error} onRetry={krs.reload} empty={!k?.items.length} emptyText="Belum ada mata kuliah yang diambil">
            <ul className="divide-y divide-slate-800">
              {k?.items.map((i) => (
                <li key={i.krsId} className="px-5 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white truncate">
                      {i.namaMk} <span className="text-slate-500">· {i.sks} SKS</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {hariLabel(i.hari)} {i.jamMulai}–{i.jamSelesai} · {i.ruangan} · {i.namaDosen}
                    </p>
                  </div>
                  {k.editable && (
                    <button
                      className="btn-ghost btn-sm hover:text-rose-400"
                      aria-label={`Batalkan ${i.namaMk}`}
                      onClick={() =>
                        confirm('Batalkan mata kuliah?', `${i.namaMk} akan dihapus dari KRS Anda.`, async () => {
                          try {
                            const r = await del(`/krs/${i.krsId}`);
                            toast.success(r.message);
                            refresh();
                          } catch (err) {
                            toast.error(errorMessage(err));
                            throw err;
                          }
                        })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </DataState>
        </section>

        {/* Penawaran */}
        <section className="card 2xl:col-span-3 min-w-0">
          <div className="px-5 pt-5 pb-3">
            <h2 className="font-semibold text-white">Kelas yang ditawarkan</h2>
            <p className="text-xs text-slate-500 mt-1">Kuota, bentrok jadwal, batas SKS, dan prasyarat diperiksa saat Anda menambahkan kelas.</p>
          </div>
          <DataState loading={penawaran.loading} error={penawaran.error} onRetry={penawaran.reload} empty={!penawaran.data?.length} emptyText="Belum ada kelas yang dibuka">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mata kuliah</th>
                    <th>Jadwal</th>
                    <th className="text-right">Kuota</th>
                    <th className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {penawaran.data?.map((j) => {
                    const penuh = j.terisi >= j.kapasitas;
                    const mkSama = !j.diambil && diambilMk.has(j.kodeMk);
                    const reason = !j.prasyaratTerpenuhi
                      ? `Prasyarat ${j.kodePrasyarat}`
                      : penuh
                        ? 'Penuh'
                        : mkSama
                          ? 'Sudah diambil di kelas lain'
                          : j.sks > sisaSks
                            ? 'Melebihi batas SKS'
                            : null;
                    return (
                      <tr key={j.id}>
                        <td className="!whitespace-normal">
                          <p className="text-white">{j.namaMk}</p>
                          <p className="text-xs text-slate-500">
                            {j.kodeMk} · {j.sks} SKS · {j.namaDosen}
                          </p>
                        </td>
                        <td className="text-slate-300">
                          {hariLabel(j.hari)} {j.jamMulai}–{j.jamSelesai}
                          <p className="text-xs text-slate-500">
                            {j.ruangan}
                            {j.kelas ? ` · ${j.kelas}` : ''}
                          </p>
                        </td>
                        <td className={clsx('text-right tabular-nums', penuh && 'text-amber-400')}>
                          {j.terisi}/{j.kapasitas}
                        </td>
                        <td className="text-right">
                          {j.diambil ? (
                            <span className="badge bg-primary-500/15 text-primary-500">Diambil</span>
                          ) : reason ? (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500" title={reason}>
                              <Lock className="h-3.5 w-3.5" /> {reason}
                            </span>
                          ) : (
                            <button className="btn-solid btn-sm" onClick={() => ambil(j)} disabled={busyId !== null || !k?.editable}>
                              {busyId === j.id ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Ambil
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DataState>
        </section>
      </div>
      {dialog}
    </>
  );
}
