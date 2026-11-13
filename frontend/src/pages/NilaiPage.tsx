import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage, get, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { angka, hariLabel } from '@/lib/format';
import type { Dashboard, Jadwal, NilaiKelas, Periode } from '@/lib/types';
import { DataState, GradeBadge, PageHeader, Spinner } from '@/components/ui';

type Draft = Record<string, { tugas: string; uts: string; uas: string }>;

// Pratinjau saja — server tetap menghitung ulang nilai akhir & huruf saat disimpan.
const preview = (t: string, u: string, a: string) => {
  if (t === '' || u === '' || a === '') return { akhir: null, grade: null };
  const akhir = Math.round((Number(t) * 0.3 + Number(u) * 0.3 + Number(a) * 0.4) * 100) / 100;
  const grade = akhir >= 85 ? 'A' : akhir >= 80 ? 'B+' : akhir >= 70 ? 'B' : akhir >= 65 ? 'C+' : akhir >= 55 ? 'C' : akhir >= 40 ? 'D' : 'E';
  return { akhir, grade };
};

const valid = (v: string) => v === '' || (/^\d{1,3}(\.\d{1,2})?$/.test(v) && Number(v) <= 100);

export default function NilaiPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const jadwalId = params.get('jadwal');

  // Kelas yang bisa dinilai: dosen → kelas yang diampu; admin → semua kelas periode aktif.
  const kelas = useFetch(async () => {
    if (user?.role === 'DOSEN') {
      const d = await get<Dashboard>('/dashboard');
      return { data: d.data.role === 'DOSEN' ? d.data.jadwal : [] };
    }
    const p = await get<Periode>('/periode');
    return get<Jadwal[]>('/jadwal', { semester: p.data.semester, tahunAjaran: p.data.tahunAjaran });
  }, [user?.role]);

  const detail = useFetch(
    () => (jadwalId ? get<NilaiKelas>(`/nilai/kelas/${jadwalId}`) : Promise.resolve({ data: null as NilaiKelas | null })),
    [jadwalId]
  );

  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Draft = {};
    detail.data?.peserta.forEach((p) => {
      next[p.nim] = { tugas: p.tugas?.toString() ?? '', uts: p.uts?.toString() ?? '', uas: p.uas?.toString() ?? '' };
    });
    setDraft(next);
  }, [detail.data]);

  const dirty = useMemo(
    () =>
      detail.data?.peserta.filter((p) => {
        const d = draft[p.nim];
        return d && (d.tugas !== (p.tugas?.toString() ?? '') || d.uts !== (p.uts?.toString() ?? '') || d.uas !== (p.uas?.toString() ?? ''));
      }) ?? [],
    [draft, detail.data]
  );
  const invalid = Object.values(draft).some((d) => !valid(d.tugas) || !valid(d.uts) || !valid(d.uas));

  const save = async () => {
    if (!jadwalId || !dirty.length) return;
    setSaving(true);
    try {
      const num = (v: string) => (v === '' ? null : Number(v));
      const r = await put<NilaiKelas>(`/nilai/kelas/${jadwalId}`, {
        nilai: dirty.map((p) => ({ nim: p.nim, tugas: num(draft[p.nim].tugas), uts: num(draft[p.nim].uts), uas: num(draft[p.nim].uas) })),
      });
      detail.setData(r.data);
      toast.success(r.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const setCell = (nim: string, k: 'tugas' | 'uts' | 'uas', v: string) => setDraft((d) => ({ ...d, [nim]: { ...d[nim], [k]: v } }));
  const j = detail.data?.jadwal;

  return (
    <>
      <PageHeader title="Input Nilai" subtitle="Bobot nilai akhir: tugas 30%, UTS 30%, UAS 40%" />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <section className="card self-start">
          <h2 className="px-5 pt-5 pb-3 text-sm font-semibold text-white">Pilih kelas</h2>
          <DataState loading={kelas.loading} error={kelas.error} onRetry={kelas.reload} empty={!kelas.data?.length} emptyText="Tidak ada kelas pada periode ini">
            <ul className="pb-2">
              {kelas.data?.map((k) => (
                <li key={k.id}>
                  <button
                    onClick={() => setParams({ jadwal: k.id })}
                    className={`w-full text-left px-5 py-2.5 transition-colors ${k.id === jadwalId ? 'bg-primary-500/15' : 'hover:bg-slate-800/60'}`}
                  >
                    <p className={`text-sm ${k.id === jadwalId ? 'text-primary-500' : 'text-white'}`}>{k.namaMk}</p>
                    <p className="text-xs text-slate-500">
                      {hariLabel(k.hari)} {k.jamMulai} · {k.terisi} peserta
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </DataState>
        </section>

        <section className="card min-w-0">
          {!jadwalId ? (
            <p className="text-sm text-slate-500 text-center py-16">Pilih kelas di samping untuk mulai menginput nilai.</p>
          ) : (
            <DataState loading={detail.loading} error={detail.error} onRetry={detail.reload}>
              {j && (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
                    <div>
                      <h2 className="font-semibold text-white">{j.namaMk}</h2>
                      <p className="text-xs text-slate-500">
                        {j.kodeMk} · {j.semester} {j.tahunAjaran} · {hariLabel(j.hari)} {j.jamMulai}–{j.jamSelesai} · {j.ruangan}
                      </p>
                    </div>
                    <button className="btn-solid" onClick={save} disabled={saving || invalid || dirty.length === 0}>
                      {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                      Simpan{dirty.length ? ` (${dirty.length})` : ''}
                    </button>
                  </div>
                  {invalid && <p className="px-5 pb-2 text-xs text-rose-400">Nilai harus angka 0–100 (maks. 2 desimal).</p>}
                  {detail.data!.peserta.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-12">Belum ada mahasiswa yang mengambil kelas ini.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>NIM</th>
                            <th>Nama</th>
                            <th className="w-24">Tugas</th>
                            <th className="w-24">UTS</th>
                            <th className="w-24">UAS</th>
                            <th className="text-right">Akhir</th>
                            <th className="text-center">Huruf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.data!.peserta.map((p) => {
                            const d = draft[p.nim] ?? { tugas: '', uts: '', uas: '' };
                            const pv = preview(d.tugas, d.uts, d.uas);
                            return (
                              <tr key={p.nim}>
                                <td className="font-mono text-slate-300">{p.nim}</td>
                                <td className="text-white">{p.namaMhs}</td>
                                {(['tugas', 'uts', 'uas'] as const).map((k) => (
                                  <td key={k} className="py-2">
                                    <input
                                      className={`input h-9 w-20 text-right ${valid(d[k]) ? '' : 'border-rose-500'}`}
                                      inputMode="decimal"
                                      aria-label={`${k} ${p.namaMhs}`}
                                      value={d[k]}
                                      onChange={(e) => setCell(p.nim, k, e.target.value.replace(',', '.'))}
                                    />
                                  </td>
                                ))}
                                <td className="text-right tabular-nums">{angka(pv.akhir)}</td>
                                <td className="text-center">
                                  <GradeBadge grade={pv.grade} />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </DataState>
          )}
        </section>
      </div>
    </>
  );
}
