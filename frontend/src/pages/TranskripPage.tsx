import { Printer } from 'lucide-react';
import { get } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { angka } from '@/lib/format';
import type { Transkrip } from '@/lib/types';
import { DataState, PageHeader } from '@/components/ui';
import NilaiTable from '@/components/NilaiTable';

export default function TranskripPage() {
  const { data, error, loading, reload } = useFetch(() => get<Transkrip>('/nilai/transkrip'), []);

  return (
    <>
      <PageHeader
        title="Transkrip Nilai"
        subtitle="Nilai terbaik untuk setiap mata kuliah yang pernah diambil"
        actions={
          <button className="btn-ghost" onClick={() => window.print()} disabled={!data?.items.length}>
            <Printer className="h-4 w-4" /> Cetak
          </button>
        }
      />
      <DataState loading={loading} error={error} onRetry={reload} empty={!data?.items.length} emptyText="Belum ada nilai">
        {data && (
          <div className="card">
            <dl className="grid gap-4 sm:grid-cols-4 px-5 pt-5 pb-4 text-sm">
              <div>
                <dt className="text-slate-500">Nama</dt>
                <dd className="text-white">{data.mahasiswa.namaMhs}</dd>
              </div>
              <div>
                <dt className="text-slate-500">NIM</dt>
                <dd className="text-white font-mono">{data.mahasiswa.nim}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Total SKS</dt>
                <dd className="text-white">{data.totalSks}</dd>
              </div>
              <div>
                <dt className="text-slate-500">IPK</dt>
                <dd className="text-2xl font-semibold text-white">{angka(data.ipk)}</dd>
              </div>
            </dl>
            <NilaiTable items={data.items} showPeriode />
          </div>
        )}
      </DataState>
    </>
  );
}
