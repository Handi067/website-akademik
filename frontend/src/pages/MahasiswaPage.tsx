import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Mahasiswa } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Pagination, Spinner, useConfirm } from '@/components/ui';

const EMPTY = { nim: '', namaMhs: '', jurusan: 'Teknik Informatika', angkatan: String(new Date().getFullYear()), noHp: '', alamat: '', username: '', email: '', password: '' };

export default function MahasiswaPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useFetch(
    () => get<{ mahasiswa: Mahasiswa[]; pagination: { page: number; totalPages: number; total: number } }>('/mahasiswa', { page, limit: 10, search: query || undefined }),
    [page, query]
  );
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    try {
      const profil = { namaMhs: form.namaMhs, jurusan: form.jurusan, angkatan: form.angkatan, noHp: form.noHp || undefined, alamat: form.alamat || undefined };
      if (editing) {
        await put(`/mahasiswa/${editing}`, profil);
        toast.success('Data mahasiswa diperbarui');
      } else {
        await post('/mahasiswa', { ...profil, nim: form.nim, username: form.username, email: form.email, password: form.password });
        toast.success('Mahasiswa ditambahkan');
      }
      setForm(null);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (m: Mahasiswa) => {
    setEditing(m.nim);
    setForm({ ...EMPTY, nim: m.nim, namaMhs: m.namaMhs, jurusan: m.jurusan, angkatan: m.angkatan, noHp: m.noHp ?? '', alamat: m.alamat ?? '', username: m.user.username, email: m.user.email });
  };

  const rows = data?.mahasiswa ?? [];

  return (
    <>
      <PageHeader
        title="Mahasiswa"
        subtitle={data ? `${data.pagination.total} mahasiswa terdaftar` : undefined}
        actions={
          <button className="btn-solid" onClick={() => { setEditing(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4" /> Tambah mahasiswa
          </button>
        }
      />

      <form
        className="relative mb-4 max-w-sm"
        onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}
      >
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
        <input className="input pl-10" placeholder="Cari NIM atau nama, lalu Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>

      <div className="card">
        <DataState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={query ? 'Tidak ada yang cocok' : 'Belum ada mahasiswa'}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>NIM</th>
                  <th>Nama</th>
                  <th>Jurusan</th>
                  <th>Angkatan</th>
                  <th>Akun</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.nim}>
                    <td className="font-mono text-slate-300">{m.nim}</td>
                    <td className="text-white">{m.namaMhs}</td>
                    <td>{m.jurusan}</td>
                    <td>{m.angkatan}</td>
                    <td className="text-slate-400">{m.user.username}</td>
                    <td className="text-right space-x-1">
                      <button className="btn-ghost btn-sm" onClick={() => openEdit(m)} aria-label={`Ubah ${m.namaMhs}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-ghost btn-sm hover:text-rose-400"
                        aria-label={`Hapus ${m.namaMhs}`}
                        onClick={() =>
                          confirm('Hapus mahasiswa?', `${m.namaMhs} (${m.nim}) beserta akun loginnya akan dihapus.`, async () => {
                            try {
                              await del(`/mahasiswa/${m.nim}`);
                              toast.success('Mahasiswa dihapus');
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
          {data && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}
        </DataState>
      </div>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={editing ? 'Ubah mahasiswa' : 'Tambah mahasiswa'} wide>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NIM">
                <input className="input font-mono" value={form.nim} onChange={set('nim')} required pattern="[0-9]{8,20}" title="8–20 digit angka" disabled={!!editing} />
              </Field>
              <Field label="Nama lengkap">
                <input className="input" value={form.namaMhs} onChange={set('namaMhs')} required minLength={3} maxLength={100} />
              </Field>
              <Field label="Jurusan">
                <input className="input" value={form.jurusan} onChange={set('jurusan')} required minLength={3} maxLength={50} />
              </Field>
              <Field label="Angkatan">
                <input className="input" value={form.angkatan} onChange={set('angkatan')} required pattern="[0-9]{4}" title="Tahun 4 digit" />
              </Field>
              <Field label="No. HP (opsional)">
                <input className="input" value={form.noHp} onChange={set('noHp')} pattern="\+?[0-9]{10,15}" title="10–15 digit" />
              </Field>
              <Field label="Alamat (opsional)">
                <input className="input" value={form.alamat} onChange={set('alamat')} maxLength={500} />
              </Field>
            </div>
            {!editing && (
              <fieldset className="border-t border-slate-700/70 pt-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400 pr-2">Akun login</legend>
                <div className="grid gap-4 sm:grid-cols-3 mt-2">
                  <Field label="Username">
                    <input className="input" value={form.username} onChange={set('username')} required pattern="[A-Za-z0-9_]{3,50}" title="3–50 huruf, angka, atau _" autoComplete="off" />
                  </Field>
                  <Field label="Email">
                    <input className="input" type="email" value={form.email} onChange={set('email')} required />
                  </Field>
                  <Field label="Password awal">
                    <input className="input" type="password" value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" />
                  </Field>
                </div>
              </fieldset>
            )}
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
