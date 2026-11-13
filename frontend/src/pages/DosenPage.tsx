import { FormEvent, useState } from 'react';
import toast from 'react-hot-toast';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Dosen } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Pagination, Spinner, useConfirm } from '@/components/ui';

const EMPTY = { nidn: '', namaDosen: '', gelarDepan: '', gelarBelakang: '', email: '', noHp: '', departemen: '', username: '', password: '' };

export default function DosenPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // /dosen returns pagination beside `data`, so keep the whole response.
  const { data: res, error, loading, reload } = useFetch(
    () => get<Dosen[]>('/dosen', { page, limit: 10, search: query || undefined }).then((r) => ({ data: r })),
    [page, query]
  );
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();

  const rows = res?.data ?? [];
  const paging = res?.pagination ?? null;

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => f && { ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    const profil = {
      namaDosen: form.namaDosen,
      email: form.email,
      gelarDepan: form.gelarDepan,
      gelarBelakang: form.gelarBelakang,
      noHp: form.noHp,
      departemen: form.departemen,
    };
    try {
      if (editing) {
        await put(`/dosen/${editing}`, profil);
        toast.success('Data dosen diperbarui');
      } else {
        await post('/dosen', { ...profil, nidn: form.nidn, username: form.username, password: form.password });
        toast.success('Dosen ditambahkan');
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
        title="Dosen"
        subtitle={paging ? `${paging.total} dosen terdaftar` : undefined}
        actions={
          <button className="btn-solid" onClick={() => { setEditing(null); setForm(EMPTY); }}>
            <Plus className="h-4 w-4" /> Tambah dosen
          </button>
        }
      />

      <form className="relative mb-4 max-w-sm" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(search.trim()); }}>
        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-500" />
        <input className="input pl-10" placeholder="Cari NIDN atau nama, lalu Enter" value={search} onChange={(e) => setSearch(e.target.value)} />
      </form>

      <div className="card">
        <DataState loading={loading} error={error} onRetry={reload} empty={rows.length === 0} emptyText={query ? 'Tidak ada yang cocok' : 'Belum ada dosen'}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>NIDN</th>
                  <th>Nama</th>
                  <th>Departemen</th>
                  <th>Email</th>
                  <th className="text-right">Kelas</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.nidn}>
                    <td className="font-mono text-slate-300">{d.nidn}</td>
                    <td className="text-white">{d.namaDosen}</td>
                    <td>{d.departemen ?? '–'}</td>
                    <td className="text-slate-400">{d.email ?? '–'}</td>
                    <td className="text-right">{d._count.jadwalKuliah}</td>
                    <td className="text-right space-x-1">
                      <button
                        className="btn-ghost btn-sm"
                        aria-label={`Ubah ${d.namaDosen}`}
                        onClick={() => {
                          setEditing(d.nidn);
                          setForm({
                            ...EMPTY,
                            nidn: d.nidn,
                            namaDosen: d.namaDosen,
                            gelarDepan: d.gelarDepan ?? '',
                            gelarBelakang: d.gelarBelakang ?? '',
                            email: d.email ?? '',
                            noHp: d.noHp ?? '',
                            departemen: d.departemen ?? '',
                            username: d.user.username,
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="btn-ghost btn-sm hover:text-rose-400"
                        aria-label={`Hapus ${d.namaDosen}`}
                        onClick={() =>
                          confirm('Hapus dosen?', `${d.namaDosen} (${d.nidn}) beserta akun loginnya akan dihapus.`, async () => {
                            try {
                              await del(`/dosen/${d.nidn}`);
                              toast.success('Dosen dihapus');
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
          {paging && <Pagination page={page} totalPages={paging.totalPages} onChange={setPage} />}
        </DataState>
      </div>

      <Modal open={!!form} onClose={() => !busy && setForm(null)} title={editing ? 'Ubah dosen' : 'Tambah dosen'} wide>
        {form && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NIDN">
                <input className="input font-mono" value={form.nidn} onChange={set('nidn')} required pattern="[0-9]{8,20}" title="8–20 digit angka" disabled={!!editing} />
              </Field>
              <Field label="Nama lengkap">
                <input className="input" value={form.namaDosen} onChange={set('namaDosen')} required minLength={3} maxLength={100} />
              </Field>
              <Field label="Gelar depan (opsional)">
                <input className="input" value={form.gelarDepan} onChange={set('gelarDepan')} maxLength={20} />
              </Field>
              <Field label="Gelar belakang (opsional)">
                <input className="input" value={form.gelarBelakang} onChange={set('gelarBelakang')} maxLength={50} />
              </Field>
              <Field label="Email">
                <input className="input" type="email" value={form.email} onChange={set('email')} required />
              </Field>
              <Field label="No. HP (opsional)">
                <input className="input" value={form.noHp} onChange={set('noHp')} pattern="\+?[0-9]{10,15}" title="10–15 digit" />
              </Field>
              <Field label="Departemen (opsional)">
                <input className="input" value={form.departemen} onChange={set('departemen')} maxLength={50} />
              </Field>
            </div>
            {!editing && (
              <fieldset className="border-t border-slate-700/70 pt-4">
                <legend className="text-xs font-semibold uppercase tracking-wide text-slate-400 pr-2">Akun login</legend>
                <div className="grid gap-4 sm:grid-cols-2 mt-2">
                  <Field label="Username">
                    <input className="input" value={form.username} onChange={set('username')} required pattern="[A-Za-z0-9_]{3,50}" title="3–50 huruf, angka, atau _" autoComplete="off" />
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
