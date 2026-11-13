import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Matakuliah } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Spinner, useConfirm } from '@/components/ui';

const EMPTY = { kodeMk: '', namaMk: '', sks: '3', semester: '1', deskripsi: '', kodePrasyarat: '' };

export default function MatakuliahPage() {
  const { data, error, loading, reload } = useFetch(() => get<Matakuliah[]>('/matakuliah'), []);
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  const rows = data ?? [];

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const body = { namaMk: form.namaMk, sks: Number(form.sks), semester: form.semester, deskripsi: form.deskripsi, kodePrasyarat: form.kodePrasyarat };
    try {
      if (editing) {
        await put(`/matakuliah/${editing}`, body);
        toast.success('Mata kuliah diperbarui');
      } else {
        await post('/matakuliah', { ...body, kodeMk: form.kodeMk });
        toast.success('Mata kuliah ditambahkan');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Mata Kuliah"
        subtitle={data ? `${rows.length} mata kuliah · ${rows.reduce((s, m) => s + m.sks, 0)} SKS total` : undefined}
        actions={
          <button className="btn-solid" onClick={() => { setEditing(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4" /> Tambah mata kuliah
          </button>
        }
      />
      <div className="card">
        <DataState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText="Belum ada mata kuliah">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Nama</th>
                  <th className="text-right">SKS</th>
                  <th className="text-right">Smt</th>
                  <th>Prasyarat</th>
                  <th className="text-right">Kelas</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.kodeMk}>
                    <td className="font-mono text-slate-300">{m.kodeMk}</td>
                    <td className="text-white">{m.namaMk}</td>
                    <td className="text-right">{m.sks}</td>
                    <td className="text-right">{m.semester}</td>
                    <td className="text-slate-400">{m.prasyarat ? `${m.prasyarat.kodeMk} · ${m.prasyarat.namaMk}` : '–'}</td>
                    <td className="text-right">{m.jumlahJadwal}</td>
                    <td className="text-right space-x-1">
                      <button
                        className="btn-ghost btn-sm"
                        aria-label={`Ubah ${m.namaMk}`}
                        onClick={() => {
                          setEditing(m.kodeMk);
                          setForm({ kodeMk: m.kodeMk, namaMk: m.namaMk, sks: String(m.sks), semester: m.semester, deskripsi: m.deskripsi ?? '', kodePrasyarat: m.kodePrasyarat ?? '' });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-ghost btn-sm hover:text-rose-400"
                        aria-label={`Hapus ${m.namaMk}`}
                        onClick={() =>
                          confirm('Hapus mata kuliah?', `${m.kodeMk} ${m.namaMk} akan dihapus.`, async () => {
                            try {
                              await del(`/matakuliah/${m.kodeMk}`);
                              toast.success('Mata kuliah dihapus');
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataState>
      </div>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={editing ? 'Ubah mata kuliah' : 'Tambah mata kuliah'}>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 grid-cols-3">
              <Field label="Kode">
                <input className="input font-mono uppercase" value={form.kodeMk} onChange={set('kodeMk')} required pattern="[A-Za-z0-9]{2,10}" title="2–10 huruf/angka" disabled={!!editing} />
              </Field>
              <Field label="SKS">
                <input className="input" type="number" min={1} max={6} value={form.sks} onChange={set('sks')} required />
              </Field>
              <Field label="Semester">
                <input className="input" type="number" min={1} max={14} value={form.semester} onChange={set('semester')} required />
              </Field>
            </div>
            <Field label="Nama mata kuliah">
              <input className="input" value={form.namaMk} onChange={set('namaMk')} required minLength={3} maxLength={100} />
            </Field>
            <Field label="Prasyarat (opsional)">
              <select className="input" value={form.kodePrasyarat} onChange={set('kodePrasyarat')}>
                <option value="">Tidak ada</option>
                {rows
                  .filter((m) => m.kodeMk !== editing)
                  .map((m) => (
                    <option key={m.kodeMk} value={m.kodeMk}>
                      {m.kodeMk} · {m.namaMk}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Deskripsi (opsional)">
              <textarea className="input" rows={3} value={form.deskripsi} onChange={set('deskripsi')} maxLength={2000} />
            </Field>
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
