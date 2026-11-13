import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { hariLabel } from '@/lib/format';
import type { AbsensiKelas, Dashboard, Jadwal, LembarAbsensi, Periode, RekapAbsensiMk, StatusHadir } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Spinner, useConfirm } from '@/components/ui';

const STATUS: StatusHadir[] = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'];
const STATUS_STYLE: Record<StatusHadir, string> = {
  HADIR: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  IZIN: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  SAKIT: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  ALPA: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
};
const label = (s: StatusHadir) => s.charAt(0) + s.slice(1).toLowerCase();
const persenText = (p: number | null) => (p === null ? '–' : `${p}%`);
const persenColor = (p: number | null) => (p === null ? 'text-slate-500' : p >= 75 ? 'text-emerald-400' : 'text-rose-400');
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD zona lokal

export default function AbsensiPage() {
  const { user } = useAuth();
  return user?.role === 'MAHASISWA' ? <RekapSaya /> : <AbsensiDosen />;
}

/* ───────────────────────── Mahasiswa ───────────────────────── */

function RekapSaya() {
  const rekap = useFetch(async () => {
    const p = await get<Periode>('/periode');
    return get<RekapAbsensiMk[]>('/absensi/saya', { semester: p.data.semester, tahunAjaran: p.data.tahunAjaran });
  }, []);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader title="Kehadiran" subtitle="Rekap kehadiran per mata kuliah periode aktif. Minimal 75% untuk mengikuti UAS." />
      <section className="card">
        <DataState loading={rekap.loading} error={rekap.error} onRetry={rekap.reload} empty={!rekap.data?.length} emptyText="Belum ada mata kuliah di KRS periode ini">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mata kuliah</th>
                  <th className="text-center">Pertemuan</th>
                  {STATUS.map((s) => (
                    <th key={s} className="text-center">{label(s)}</th>
                  ))}
                  <th className="text-right">Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {rekap.data?.map((r) => (
                  <Fragment key={r.jadwalId}>
                    <tr className="cursor-pointer hover:bg-slate-800/40" onClick={() => setOpen(open === r.jadwalId ? null : r.jadwalId)}>
                      <td>
                        <p className="text-white">{r.namaMk}</p>
                        <p className="text-xs text-slate-500">{r.kodeMk} · {r.namaDosen}</p>
                      </td>
                      <td className="text-center tabular-nums">{r.totalPertemuan}</td>
                      {STATUS.map((s) => (
                        <td key={s} className="text-center tabular-nums">{r[s]}</td>
                      ))}
                      <td className={`text-right font-semibold tabular-nums ${persenColor(r.persentase)}`}>{persenText(r.persentase)}</td>
                    </tr>
                    {open === r.jadwalId && (
                      <tr>
                        <td colSpan={7} className="bg-slate-900/40">
                          {r.detail.length === 0 ? (
                            <p className="text-xs text-slate-500 py-2">Belum ada pertemuan.</p>
                          ) : (
                            <ul className="grid gap-1 py-2 sm:grid-cols-2">
                              {r.detail.map((d) => (
                                <li key={d.pertemuanKe} className="flex items-center gap-3 text-xs">
                                  <span className="w-8 text-slate-500">#{d.pertemuanKe}</span>
                                  <span className="w-24 text-slate-400">{d.tanggal}</span>
                                  <StatusBadge status={d.statusHadir} />
                                  <span className="truncate text-slate-400">{d.topik ?? ''}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </section>
    </>
  );
}

function StatusBadge({ status }: { status: StatusHadir | null }) {
  if (!status) return <span className="text-xs text-slate-500">belum diisi</span>;
  return <span className={`rounded-md border px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{label(status)}</span>;
}

/* ───────────────────────── Dosen / Admin ───────────────────────── */

function AbsensiDosen() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const jadwalId = params.get('jadwal');
  const pertemuanId = params.get('pertemuan');

  const kelas = useFetch(async () => {
    if (user?.role === 'DOSEN') {
      const d = await get<Dashboard>('/dashboard');
      return { data: d.data.role === 'DOSEN' ? d.data.jadwal : [] };
    }
    const p = await get<Periode>('/periode');
    return get<Jadwal[]>('/jadwal', { semester: p.data.semester, tahunAjaran: p.data.tahunAjaran });
  }, [user?.role]);

  return (
    <>
      <PageHeader title="Absensi" subtitle="Kelola pertemuan dan catat kehadiran mahasiswa" />
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
            <p className="text-sm text-slate-500 text-center py-16">Pilih kelas di samping untuk mengelola absensi.</p>
          ) : pertemuanId ? (
            <Lembar id={pertemuanId} onBack={() => setParams({ jadwal: jadwalId })} />
          ) : (
            <Kelas jadwalId={jadwalId} onOpen={(id) => setParams({ jadwal: jadwalId, pertemuan: id })} />
          )}
        </section>
      </div>
    </>
  );
}

function Kelas({ jadwalId, onOpen }: { jadwalId: string; onOpen: (pertemuanId: string) => void }) {
  const detail = useFetch(() => get<AbsensiKelas>(`/absensi/kelas/${jadwalId}`), [jadwalId]);
  const [form, setForm] = useState<{ tanggal: string; topik: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirm();

  const create = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const r = await post<{ id: string }>(`/absensi/kelas/${jadwalId}/pertemuan`, form);
      toast.success(r.message);
      setForm(null);
      onOpen(r.data.id);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const j = detail.data?.jadwal;
  return (
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
            <button className="btn-solid" onClick={() => setForm({ tanggal: today(), topik: '' })}>
              <Plus className="h-4 w-4" /> Pertemuan baru
            </button>
          </div>

          <h3 className="px-5 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pertemuan</h3>
          {detail.data!.pertemuan.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Belum ada pertemuan.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Tanggal</th>
                    <th>Topik</th>
                    <th className="text-center">Hadir</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.data!.pertemuan.map((p) => (
                    <tr key={p.id}>
                      <td className="tabular-nums">{p.pertemuanKe}</td>
                      <td>{p.tanggal}</td>
                      <td className="text-white">{p.topik ?? '–'}</td>
                      <td className="text-center tabular-nums">
                        {p.jumlahHadir}/{detail.data!.peserta.length}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <button className="btn-ghost h-8 text-xs" onClick={() => onOpen(p.id)}>Isi absensi</button>
                        <button
                          className="p-2 text-slate-400 hover:text-rose-400"
                          aria-label={`Hapus pertemuan ${p.pertemuanKe}`}
                          onClick={() =>
                            confirm('Hapus pertemuan', `Pertemuan ke-${p.pertemuanKe} beserta seluruh data absensinya akan dihapus.`, async () => {
                              const r = await del(`/absensi/pertemuan/${p.id}`);
                              toast.success(r.message);
                              detail.reload();
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="px-5 pt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Rekap peserta</h3>
          {detail.data!.peserta.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Belum ada mahasiswa yang mengambil kelas ini.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>NIM</th>
                    <th>Nama</th>
                    {STATUS.map((s) => (
                      <th key={s} className="text-center">{label(s)}</th>
                    ))}
                    <th className="text-right">Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data!.peserta.map((p) => (
                    <tr key={p.nim}>
                      <td className="font-mono text-slate-300">{p.nim}</td>
                      <td className="text-white">{p.namaMhs}</td>
                      {STATUS.map((s) => (
                        <td key={s} className="text-center tabular-nums">{p[s]}</td>
                      ))}
                      <td className={`text-right font-semibold tabular-nums ${persenColor(p.persentase)}`}>{persenText(p.persentase)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Modal open={!!form} onClose={() => !saving && setForm(null)} title="Pertemuan baru">
            {form && (
              <div className="space-y-4">
                <Field label="Tanggal">
                  <input type="date" className="input" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
                </Field>
                <Field label="Topik" hint="Opsional, maks. 200 karakter">
                  <input className="input" maxLength={200} value={form.topik} onChange={(e) => setForm({ ...form, topik: e.target.value })} />
                </Field>
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setForm(null)} disabled={saving}>Batal</button>
                  <button className="btn-solid" onClick={create} disabled={saving || !form.tanggal}>
                    {saving && <Spinner className="h-4 w-4" />} Buat
                  </button>
                </div>
              </div>
            )}
          </Modal>
          {dialog}
        </>
      )}
    </DataState>
  );
}

type Draft = Record<string, StatusHadir | null>;

function Lembar({ id, onBack }: { id: string; onBack: () => void }) {
  const detail = useFetch(() => get<LembarAbsensi>(`/absensi/pertemuan/${id}`), [id]);
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Draft = {};
    detail.data?.peserta.forEach((p) => (next[p.nim] = p.statusHadir));
    setDraft(next);
  }, [detail.data]);

  const dirty = useMemo(
    () => detail.data?.peserta.filter((p) => draft[p.nim] && draft[p.nim] !== p.statusHadir) ?? [],
    [draft, detail.data]
  );

  const save = async () => {
    if (!dirty.length) return;
    setSaving(true);
    try {
      const r = await put<LembarAbsensi>(`/absensi/pertemuan/${id}`, {
        absensi: dirty.map((p) => ({ nim: p.nim, statusHadir: draft[p.nim] })),
      });
      detail.setData(r.data);
      toast.success(r.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const semuaHadir = () => setDraft((d) => Object.fromEntries(Object.keys(d).map((nim) => [nim, d[nim] ?? 'HADIR'])));
  const p = detail.data?.pertemuan;

  return (
    <DataState loading={detail.loading} error={detail.error} onRetry={detail.reload}>
      {p && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div>
              <button onClick={onBack} className="mb-1 flex items-center gap-1 text-xs text-slate-400 hover:text-white">
                <ArrowLeft className="h-3 w-3" /> Kembali ke kelas
              </button>
              <h2 className="font-semibold text-white">
                {p.namaMk} — Pertemuan {p.pertemuanKe}
              </h2>
              <p className="text-xs text-slate-500">
                {p.tanggal}
                {p.topik ? ` · ${p.topik}` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={semuaHadir}>Isi kosong = Hadir</button>
              <button className="btn-solid" onClick={save} disabled={saving || dirty.length === 0}>
                {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                Simpan{dirty.length ? ` (${dirty.length})` : ''}
              </button>
            </div>
          </div>
          {detail.data!.peserta.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">Belum ada mahasiswa yang mengambil kelas ini.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>NIM</th>
                    <th>Nama</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data!.peserta.map((m) => (
                    <tr key={m.nim}>
                      <td className="font-mono text-slate-300">{m.nim}</td>
                      <td className="text-white">{m.namaMhs}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`Status ${m.namaMhs}`}>
                          {STATUS.map((s) => (
                            <button
                              key={s}
                              role="radio"
                              aria-checked={draft[m.nim] === s}
                              onClick={() => setDraft((d) => ({ ...d, [m.nim]: s }))}
                              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                draft[m.nim] === s ? STATUS_STYLE[s] : 'border-slate-700 text-slate-400 hover:border-slate-500'
                              }`}
                            >
                              {label(s)}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </DataState>
  );
}
