import { FormEvent, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { HARI, hariLabel } from '@/lib/format';
import type { Dosen, Hari, Jadwal, Matakuliah, Periode } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Spinner, useConfirm } from '@/components/ui';

type Form = {
  kodeMk: string;
  nidn: string;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruangan: string;
  kelas: string;
  kapasitas: string;
};

const EMPTY: Form = { kodeMk: '', nidn: '', hari: 'SENIN', jamMulai: '08:00', jamSelesai: '10:30', ruangan: '', kelas: '', kapasitas: '40' };

export default function JadwalPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [periode, setPeriode] = useState<Periode | null>(null);

  useEffect(() => {
    get<Periode>('/periode').then((r) => setPeriode({ semester: r.data.semester, tahunAjaran: r.data.tahunAjaran }));
  }, []);

  const { data, error, loading, reload } = useFetch(
    () => (periode ? get<Jadwal[]>('/jadwal', { ...periode }) : Promise.resolve({ data: [] as Jadwal[] })),
    [periode?.semester, periode?.tahunAjaran]
  );

  // Option lists only matter for the admin form.
  const [mkList, setMkList] = useState<Matakuliah[]>([]);
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  useEffect(() => {
    if (!isAdmin) return;
    get<Matakuliah[]>('/matakuliah').then((r) => setMkList(r.data));
    get<Dosen[]>('/dosen', { limit: 100 }).then((r) => setDosenList(r.data));
  }, [isAdmin]);

  const [form, setForm] = useState<Form | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || !periode) return;
    setBusy(true);
    const body = { ...form, kapasitas: Number(form.kapasitas), ...periode };
    try {
      if (editing) {
        await put(`/jadwal/${editing}`, body);
        toast.success('Jadwal diperbarui');
      } else {
        await post('/jadwal', body);
        toast.success('Jadwal ditambahkan');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rows = data ?? [];

  return (
    <>
      <PageHeader
        title="Jadwal Kuliah"
        subtitle="Kelas yang dibuka pada periode yang dipilih"
        actions={
          isAdmin && (
            <button className="btn-solid" disabled={!periode} onClick={() => { setEditing(null); setForm(EMPTY); }}>
              <Plus className="h-4 w-4" /> Tambah jadwal
            </button>
          )
        }
      />

      {periode && (
        <div className="flex flex-wrap gap-3 mb-4">
          <select
            className="input w-36"
            aria-label="Semester"
            value={periode.semester}
            onChange={(e) => setPeriode({ ...periode, semester: e.target.value })}
          >
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
          <input
            className="input w-36"
            aria-label="Tahun ajaran"
            value={periode.tahunAjaran}
            onChange={(e) => /^\d{0,4}\/?\d{0,4}$/.test(e.target.value) && setPeriode({ ...periode, tahunAjaran: e.target.value })}
            placeholder="2025/2026"
          />
        </div>
      )}

      <div className="card">
        <DataState loading={loading || !periode} error={error} onRetry={reload} empty={rows.length === 0} emptyText="Belum ada jadwal pada periode ini">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Hari</th>
                  <th>Jam</th>
                  <th>Mata kuliah</th>
                  <th>Dosen</th>
                  <th>Ruang</th>
                  <th>Kelas</th>
                  <th className="text-right">Peserta</th>
                  {isAdmin && <th className="text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr key={j.id}>
                    <td>{hariLabel(j.hari)}</td>
                    <td className="tabular-nums">
                      {j.jamMulai}–{j.jamSelesai}
                    </td>
                    <td className="!whitespace-normal min-w-[12rem]">
                      <p className="text-white">{j.namaMk}</p>
                      <p className="text-xs text-slate-500">
                        {j.kodeMk} · {j.sks} SKS
                      </p>
                    </td>
                    <td className="!whitespace-normal min-w-[10rem]">{j.namaDosen}</td>
                    <td>{j.ruangan}</td>
                    <td>{j.kelas ?? '–'}</td>
                    <td className="text-right tabular-nums">
                      <span className={j.terisi >= j.kapasitas ? 'text-amber-400' : ''}>
                        {j.terisi}/{j.kapasitas}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-right space-x-1">
                        <button
                          className="btn-ghost btn-sm"
                          aria-label={`Ubah jadwal ${j.namaMk}`}
                          onClick={() => {
                            setEditing(j.id);
                            setForm({ kodeMk: j.kodeMk, nidn: j.nidn, hari: j.hari, jamMulai: j.jamMulai, jamSelesai: j.jamSelesai, ruangan: j.ruangan, kelas: j.kelas ?? '', kapasitas: String(j.kapasitas) });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn-ghost btn-sm hover:text-rose-400"
                          aria-label={`Hapus jadwal ${j.namaMk}`}
                          onClick={() =>
                            confirm('Hapus jadwal?', `${j.namaMk}, ${hariLabel(j.hari)} ${j.jamMulai} di ${j.ruangan} akan dihapus.`, async () => {
                              try {
                                await del(`/jadwal/${j.id}`);
                                toast.success('Jadwal dihapus');
                                reload();
                              } catch (err) {
                                toast.error(errorMessage(err));
                                throw err;
                              }
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={editing ? 'Ubah jadwal' : `Tambah jadwal · ${periode?.semester} ${periode?.tahunAjaran}`} wide>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mata kuliah">
                <select className="input" value={form.kodeMk} onChange={set('kodeMk')} required>
                  <option value="">Pilih mata kuliah</option>
                  {mkList.map((m) => (
                    <option key={m.kodeMk} value={m.kodeMk}>
                      {m.kodeMk} · {m.namaMk} ({m.sks} SKS)
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Dosen pengampu">
                <select className="input" value={form.nidn} onChange={set('nidn')} required>
                  <option value="">Pilih dosen</option>
                  {dosenList.map((d) => (
                    <option key={d.nidn} value={d.nidn}>
                      {d.namaDosen}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hari">
                <select className="input" value={form.hari} onChange={set('hari')}>
                  {HARI.map((h) => (
                    <option key={h} value={h}>
                      {hariLabel(h)}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Jam mulai">
                  <input className="input" type="time" value={form.jamMulai} onChange={set('jamMulai')} required />
                </Field>
                <Field label="Jam selesai">
                  <input className="input" type="time" value={form.jamSelesai} onChange={set('jamSelesai')} required />
                </Field>
              </div>
              <Field label="Ruangan">
                <input className="input" value={form.ruangan} onChange={set('ruangan')} required maxLength={20} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kelas (opsional)">
                  <input className="input" value={form.kelas} onChange={set('kelas')} maxLength={20} />
                </Field>
                <Field label="Kapasitas">
                  <input className="input" type="number" min={1} max={500} value={form.kapasitas} onChange={set('kapasitas')} required />
                </Field>
              </div>
            </div>
            <p className="text-xs text-slate-500">Sistem menolak jadwal yang bentrok ruangan atau dosennya pada hari dan jam yang sama.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-ghost" onClick={() => setForm(null)} disabled={busy}>
                Batal
              </button>
              <button className="btn-solid" disabled={busy}>
                {busy && <Spinner className="h-4 w-4" />} Simpan
              </button>
            </div>
          </form>
        )}
      </Modal>
      {dialog}
    </>
  );
}
