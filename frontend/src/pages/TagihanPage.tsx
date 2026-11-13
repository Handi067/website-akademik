import { useState } from 'react';
import toast from 'react-hot-toast';
import { Check, Plus, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { del, errorMessage, get, post, put } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { StatusPembayaran, Tagihan } from '@/lib/types';
import { DataState, Field, Modal, PageHeader, Spinner, useConfirm } from '@/components/ui';

const rupiah = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

function StatusBadge({ t }: { t: Tagihan }) {
  const [text, cls] =
    t.status === 'SUCCESS'
      ? ['Lunas', 'bg-emerald-500/15 text-emerald-400']
      : t.menungguVerifikasi
        ? ['Menunggu verifikasi', 'bg-sky-500/15 text-sky-400']
        : t.terlambat
          ? ['Terlambat', 'bg-rose-500/15 text-rose-400']
          : ['Belum dibayar', 'bg-amber-500/15 text-amber-400'];
  return <span className={`rounded-md px-2 py-0.5 text-xs whitespace-nowrap ${cls}`}>{text}</span>;
}

const lastPembayaran = (t: Tagihan) => t.pembayaran[0];

export default function TagihanPage() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <TagihanAdmin /> : <TagihanSaya />;
}

/* ───────────────────────── Mahasiswa ───────────────────────── */

function TagihanSaya() {
  const list = useFetch(() => get<Tagihan[]>('/tagihan/me'), []);
  const [target, setTarget] = useState<Tagihan | null>(null);
  const [form, setForm] = useState({ metodePembayaran: '', nomorReferensi: '' });
  const [saving, setSaving] = useState(false);

  const belum = list.data?.filter((t) => t.status !== 'SUCCESS') ?? [];
  const total = belum.reduce((s, t) => s + t.jumlah, 0);

  const kirim = async () => {
    if (!target) return;
    setSaving(true);
    try {
      const r = await post<Tagihan>(`/tagihan/${target.id}/konfirmasi`, form);
      toast.success(r.message);
      setTarget(null);
      list.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Tagihan"
        subtitle={belum.length ? `${belum.length} tagihan belum lunas · total ${rupiah(total)}` : 'Tagihan UKT/SPP dan riwayat pembayaran'}
      />
      {list.data?.some((t) => t.jenisTagihan === 'UKT' && t.terlambat) && (
        <p className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          Ada UKT yang melewati tenggat. Pengisian KRS diblokir sampai tagihan tersebut lunas.
        </p>
      )}
      <section className="card">
        <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.length} emptyText="Tidak ada tagihan">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Jenis</th>
                  <th className="text-right">Jumlah</th>
                  <th>Tenggat</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data?.map((t) => {
                  const p = lastPembayaran(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <p className="text-white">{t.jenisTagihan}</p>
                        {t.keterangan && <p className="text-xs text-slate-500">{t.keterangan}</p>}
                      </td>
                      <td className="text-right tabular-nums text-white">{rupiah(t.jumlah)}</td>
                      <td className={t.terlambat ? 'text-rose-400' : ''}>{t.tenggatWaktu}</td>
                      <td>
                        <StatusBadge t={t} />
                        {p?.status === 'FAILED' && t.status !== 'SUCCESS' && !t.menungguVerifikasi && (
                          <p className="mt-1 text-xs text-rose-400">Konfirmasi terakhir ditolak</p>
                        )}
                      </td>
                      <td className="text-right">
                        {t.status !== 'SUCCESS' && !t.menungguVerifikasi && (
                          <button
                            className="btn-solid h-8 text-xs"
                            onClick={() => {
                              setForm({ metodePembayaran: '', nomorReferensi: '' });
                              setTarget(t);
                            }}
                          >
                            <Send className="h-3.5 w-3.5" /> Konfirmasi bayar
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

      <Modal open={!!target} onClose={() => !saving && setTarget(null)} title="Konfirmasi pembayaran">
        {target && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              {target.jenisTagihan} · <span className="text-white font-semibold">{rupiah(target.jumlah)}</span>
            </p>
            <Field label="Metode pembayaran" hint="Contoh: Transfer BNI, Teller BRI">
              <input className="input" maxLength={50} value={form.metodePembayaran} onChange={(e) => setForm({ ...form, metodePembayaran: e.target.value })} />
            </Field>
            <Field label="Nomor referensi / bukti transfer">
              <input className="input" maxLength={100} value={form.nomorReferensi} onChange={(e) => setForm({ ...form, nomorReferensi: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setTarget(null)} disabled={saving}>Batal</button>
              <button
                className="btn-solid"
                onClick={kirim}
                disabled={saving || form.metodePembayaran.trim().length < 2 || form.nomorReferensi.trim().length < 3}
              >
                {saving && <Spinner className="h-4 w-4" />} Kirim
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

/* ───────────────────────── Admin ───────────────────────── */

type Filter = 'verifikasi' | 'belum' | 'semua';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'verifikasi', label: 'Menunggu verifikasi' },
  { key: 'belum', label: 'Belum lunas' },
  { key: 'semua', label: 'Semua' },
];

const emptyForm = { nim: '', jenisTagihan: 'UKT' as 'UKT' | 'SPP', jumlah: '', tenggatWaktu: '', keterangan: '' };

function TagihanAdmin() {
  const [filter, setFilter] = useState<Filter>('verifikasi');
  const list = useFetch(
    () =>
      get<Tagihan[]>(
        '/tagihan/all',
        filter === 'verifikasi' ? { menungguVerifikasi: true } : filter === 'belum' ? { status: 'PENDING' satisfies StatusPembayaran } : undefined
      ),
    [filter]
  );
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

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

  const create = async () => {
    if (!form) return;
    const done = await run('create', () => post<Tagihan>('/tagihan', { ...form, jumlah: Number(form.jumlah) }));
    if (done) setForm(null);
  };

  const verifikasi = (t: Tagihan, diterima: boolean) => run(t.id, () => put<Tagihan>(`/tagihan/${t.id}/verifikasi`, { diterima }));

  return (
    <>
      <PageHeader
        title="Tagihan & Pembayaran"
        subtitle="Terbitkan tagihan dan verifikasi konfirmasi pembayaran mahasiswa"
        actions={
          <button className="btn-solid" onClick={() => setForm({ ...emptyForm })}>
            <Plus className="h-4 w-4" /> Tagihan baru
          </button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${filter === f.key ? 'bg-primary-500/15 text-primary-500' : 'text-slate-400 hover:bg-slate-800/60'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <section className="card">
        <DataState loading={list.loading} error={list.error} onRetry={list.reload} empty={!list.data?.length} emptyText="Tidak ada tagihan">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mahasiswa</th>
                  <th>Jenis</th>
                  <th className="text-right">Jumlah</th>
                  <th>Tenggat</th>
                  <th>Status</th>
                  <th>Konfirmasi</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.data?.map((t) => {
                  const p = lastPembayaran(t);
                  return (
                    <tr key={t.id}>
                      <td>
                        <p className="text-white">{t.namaMhs}</p>
                        <p className="text-xs font-mono text-slate-500">{t.nim}</p>
                      </td>
                      <td>{t.jenisTagihan}</td>
                      <td className="text-right tabular-nums text-white">{rupiah(t.jumlah)}</td>
                      <td className={t.terlambat ? 'text-rose-400' : ''}>{t.tenggatWaktu}</td>
                      <td>
                        <StatusBadge t={t} />
                      </td>
                      <td className="text-xs">
                        {p?.metodePembayaran ? (
                          <>
                            <p className="text-slate-300">{p.metodePembayaran}</p>
                            <p className="font-mono text-slate-500">{p.nomorReferensi}</p>
                          </>
                        ) : (
                          <span className="text-slate-500">–</span>
                        )}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {t.menungguVerifikasi && (
                          <>
                            <button className="btn-solid h-8 text-xs" disabled={busy === t.id} onClick={() => verifikasi(t, true)}>
                              {busy === t.id ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} Terima
                            </button>
                            <button className="btn-ghost h-8 text-xs ml-1" disabled={busy === t.id} onClick={() => verifikasi(t, false)}>
                              <X className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </>
                        )}
                        {t.status !== 'SUCCESS' && (
                          <button
                            className="p-2 text-slate-400 hover:text-rose-400"
                            aria-label={`Hapus tagihan ${t.nim}`}
                            onClick={() =>
                              confirm('Hapus tagihan', `Tagihan ${t.jenisTagihan} ${rupiah(t.jumlah)} untuk ${t.namaMhs} akan dihapus.`, async () => {
                                const r = await del(`/tagihan/${t.id}`);
                                toast.success(r.message);
                                list.reload();
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
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

      <Modal open={!!form} onClose={() => busy !== 'create' && setForm(null)} title="Tagihan baru">
        {form && (
          <div className="space-y-4">
            <Field label="NIM">
              <input className="input" value={form.nim} onChange={(e) => setForm({ ...form, nim: e.target.value.trim() })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Jenis">
                <select className="input" value={form.jenisTagihan} onChange={(e) => setForm({ ...form, jenisTagihan: e.target.value as 'UKT' | 'SPP' })}>
                  <option value="UKT">UKT</option>
                  <option value="SPP">SPP</option>
                </select>
              </Field>
              <Field label="Jumlah (Rp)">
                <input className="input" inputMode="numeric" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value.replace(/\D/g, '') })} />
              </Field>
            </div>
            <Field label="Tenggat">
              <input type="date" className="input" value={form.tenggatWaktu} onChange={(e) => setForm({ ...form, tenggatWaktu: e.target.value })} />
            </Field>
            <Field label="Keterangan" hint="Opsional">
              <input className="input" maxLength={500} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)} disabled={busy === 'create'}>Batal</button>
              <button className="btn-solid" onClick={create} disabled={busy === 'create' || !form.nim || !Number(form.jumlah) || !form.tenggatWaktu}>
                {busy === 'create' && <Spinner className="h-4 w-4" />} Simpan
              </button>
            </div>
          </div>
        )}
      </Modal>
      {dialog}
    </>
  );
}
