import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BookPlus, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { Buku, Peminjaman } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Pagination, Spinner, useConfirm } from '@/components/ui';

interface BukuPage {
  items: Buku[];
  kategori: string[];
  pagination: { page: number; totalPages: number; total: number };
}

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

const STATUS_STYLE: Record<Peminjaman['status'], [string, string]> = {
  AKTIF: ['Dipinjam', 'bg-sky-500/15 text-sky-400'],
  TERLAMBAT: ['Terlambat', 'bg-rose-500/15 text-rose-400'],
  DIKEMBALIKAN: ['Dikembalikan', 'bg-emerald-500/15 text-emerald-400'],
};

type Tab = 'katalog' | 'peminjaman';

export default function PerpustakaanPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [tab, setTab] = useState<Tab>('katalog');
  const tabs: { key: Tab; label: string }[] = [
    { key: 'katalog', label: 'Katalog' },
    ...(user?.role !== 'DOSEN' ? [{ key: 'peminjaman' as Tab, label: isAdmin ? 'Peminjaman' : 'Pinjaman saya' }] : []),
  ];

  return (
    <>
      <PageHeader title="Perpustakaan" subtitle="Katalog buku dan peminjaman" />
      {tabs.length > 1 && (
        <div className="mb-4 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === t.key ? 'bg-primary-500/15 text-primary-500' : 'text-slate-400 hover:bg-slate-800/60'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === 'katalog' ? <Katalog isAdmin={isAdmin} /> : <DaftarPinjam isAdmin={isAdmin} />}
    </>
  );
}

/* ───────────────────────── Katalog ───────────────────────── */

const emptyBuku = { kodeBuku: '', judul: '', pengarang: '', penerbit: '', tahun: '', isbn: '', kategori: '', jumlah: '1' };
type BukuForm = typeof emptyBuku;

function Katalog({ isAdmin }: { isAdmin: boolean }) {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [kategori, setKategori] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useFetch(() => get<BukuPage>('/perpustakaan/buku', { search: q, kategori, page, limit: 20 }), [q, kategori, page]);
  const [form, setForm] = useState<{ data: BukuForm; edit: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirm();

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = { ...form.data, tahun: Number(form.data.tahun), jumlah: Number(form.data.jumlah) };
      const r = form.edit ? await put<Buku>(`/perpustakaan/buku/${form.data.kodeBuku}`, body) : await post<Buku>('/perpustakaan/buku', body);
      toast.success(r.message);
      setForm(null);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof BukuForm, v: string) => form && setForm({ ...form, data: { ...form.data, [k]: v } });
  const valid = form && form.data.kodeBuku && form.data.judul && form.data.pengarang && form.data.penerbit && form.data.kategori && Number(form.data.tahun) && Number(form.data.jumlah) >= 1;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center gap-2 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Cari judul, pengarang, kode, ISBN" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          className="input w-auto"
          value={kategori}
          onChange={(e) => {
            setKategori(e.target.value);
            setPage(1);
          }}
          aria-label="Kategori"
        >
          <option value="">Semua kategori</option>
          {list.data?.kategori.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        {isAdmin && (
          <button className="btn-solid" onClick={() => setForm({ data: { ...emptyBuku }, edit: false })}>
            <Plus className="h-4 w-4" /> Buku
          </button>
        )}
      </div>
      <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.items.length} emptyText="Buku tidak ditemukan">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Judul</th>
                <th>Kategori</th>
                <th className="text-center">Tersedia</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {list.data?.items.map((b) => (
                <tr key={b.kodeBuku}>
                  <td className="font-mono text-slate-300">{b.kodeBuku}</td>
                  <td>
                    <p className="text-white">{b.judul}</p>
                    <p className="text-xs text-slate-500">
                      {b.pengarang} · {b.penerbit}, {b.tahun}
                    </p>
                  </td>
                  <td>{b.kategori}</td>
                  <td className={`text-center tabular-nums ${b.tersedia ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {b.tersedia}/{b.jumlah}
                  </td>
                  {isAdmin && (
                    <td className="text-right whitespace-nowrap">
                      <button
                        className="p-2 text-slate-400 hover:text-white"
                        aria-label={`Ubah ${b.judul}`}
                        onClick={() =>
                          setForm({
                            edit: true,
                            data: { ...b, tahun: String(b.tahun), jumlah: String(b.jumlah), isbn: b.isbn ?? '' },
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="p-2 text-slate-400 hover:text-rose-400"
                        aria-label={`Hapus ${b.judul}`}
                        onClick={() =>
                          confirm('Hapus buku', `"${b.judul}" akan dihapus beserta riwayat peminjamannya.`, async () => {
                            const r = await del(`/perpustakaan/buku/${b.kodeBuku}`);
                            toast.success(r.message);
                            list.reload();
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {list.data && <Pagination page={page} totalPages={list.data.pagination.totalPages} onChange={setPage} />}
      </DataState>

      <Modal open={!!form} onClose={() => !saving && setForm(null)} title={form?.edit ? 'Ubah buku' : 'Tambah buku'} wide>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kode buku">
                <input className="input" disabled={form.edit} maxLength={20} value={form.data.kodeBuku} onChange={(e) => set('kodeBuku', e.target.value.toUpperCase())} />
              </Field>
              <Field label="ISBN" hint="Opsional">
                <input className="input" maxLength={20} value={form.data.isbn} onChange={(e) => set('isbn', e.target.value)} />
              </Field>
            </div>
            <Field label="Judul">
              <input className="input" maxLength={200} value={form.data.judul} onChange={(e) => set('judul', e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pengarang">
                <input className="input" maxLength={100} value={form.data.pengarang} onChange={(e) => set('pengarang', e.target.value)} />
              </Field>
              <Field label="Penerbit">
                <input className="input" maxLength={100} value={form.data.penerbit} onChange={(e) => set('penerbit', e.target.value)} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Tahun">
                <input className="input" inputMode="numeric" maxLength={4} value={form.data.tahun} onChange={(e) => set('tahun', e.target.value.replace(/\D/g, ''))} />
              </Field>
              <Field label="Kategori">
                <input className="input" list="kategori-buku" maxLength={50} value={form.data.kategori} onChange={(e) => set('kategori', e.target.value)} />
                <datalist id="kategori-buku">
                  {list.data?.kategori.map((k) => (
                    <option key={k} value={k} />
                  ))}
                </datalist>
              </Field>
              <Field label="Jumlah eksemplar">
                <input className="input" inputMode="numeric" value={form.data.jumlah} onChange={(e) => set('jumlah', e.target.value.replace(/\D/g, ''))} />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)} disabled={saving}>Batal</button>
              <button className="btn-solid" onClick={save} disabled={saving || !valid}>
                {saving && <Spinner className="h-4 w-4" />} Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
      {dialog}
    </section>
  );
}

/* ───────────────────────── Peminjaman ───────────────────────── */

function DaftarPinjam({ isAdmin }: { isAdmin: boolean }) {
  const [aktif, setAktif] = useState(isAdmin);
  const list = useFetch(() => get<Peminjaman[]>('/perpustakaan/peminjaman', aktif ? { aktif: true } : undefined), [aktif]);
  const [form, setForm] = useState<{ nim: string; kodeBuku: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ message: string }>) => {
    setBusy(key);
    try {
      toast.success((await fn()).message);
      list.reload();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const totalDenda = list.data?.filter((p) => p.status !== 'DIKEMBALIKAN').reduce((s, p) => s + p.denda, 0) ?? 0;

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-2 p-4">
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} />
          Hanya yang belum dikembalikan
        </label>
        <div className="flex items-center gap-3">
          {totalDenda > 0 && <span className="text-sm text-rose-400">Denda berjalan: {rupiah(totalDenda)}</span>}
          {isAdmin && (
            <button className="btn-solid" onClick={() => setForm({ nim: '', kodeBuku: '' })}>
              <BookPlus className="h-4 w-4" /> Catat peminjaman
            </button>
          )}
        </div>
      </div>
      <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.length} emptyText="Tidak ada peminjaman">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Buku</th>
                {isAdmin && <th>Peminjam</th>}
                <th>Pinjam</th>
                <th>Tenggat</th>
                <th>Kembali</th>
                <th>Status</th>
                <th className="text-right">Denda</th>
                {isAdmin && <th />}
              </tr>
            </thead>
            <tbody>
              {list.data?.map((p) => {
                const [text, cls] = STATUS_STYLE[p.status];
                return (
                  <tr key={p.id}>
                    <td>
                      <p className="text-white">{p.judul}</p>
                      <p className="text-xs font-mono text-slate-500">{p.kodeBuku}</p>
                    </td>
                    {isAdmin && (
                      <td>
                        <p className="text-white">{p.namaMhs}</p>
                        <p className="text-xs font-mono text-slate-500">{p.nim}</p>
                      </td>
                    )}
                    <td>{p.tanggalPinjam}</td>
                    <td className={p.status === 'TERLAMBAT' ? 'text-rose-400' : ''}>{p.tenggat}</td>
                    <td>{p.tanggalKembali ?? '–'}</td>
                    <td>
                      <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${cls}`}>
                        {text}
                        {p.terlambatHari > 0 && ` ${p.terlambatHari} hari`}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{p.denda ? rupiah(p.denda) : '–'}</td>
                    {isAdmin && (
                      <td className="text-right">
                        {p.status !== 'DIKEMBALIKAN' && (
                          <button
                            className="btn-ghost h-8 text-xs"
                            disabled={busy === p.id}
                            onClick={() => run(p.id, () => put(`/perpustakaan/peminjaman/${p.id}/kembali`))}
                          >
                            {busy === p.id ? <Spinner className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />} Kembalikan
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal open={!!form} onClose={() => busy !== 'pinjam' && setForm(null)} title="Catat peminjaman">
        {form && (
          <div className="space-y-4">
            <Field label="NIM peminjam">
              <input className="input" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value.trim() })} />
            </Field>
            <Field label="Kode buku">
              <input className="input" value={form.kodeBuku} onChange={(e) => setForm({ ...form, kodeBuku: e.target.value.trim().toUpperCase() })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)} disabled={busy === 'pinjam'}>Batal</button>
              <button
                className="btn-solid"
                disabled={busy === 'pinjam' || !form.nim || !form.kodeBuku}
                onClick={async () => {
                  if (await run('pinjam', () => post('/perpustakaan/peminjaman', form))) setForm(null);
                }}
              >
                {busy === 'pinjam' && <Spinner className="h-4 w-4" />} Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
