import { useState } from 'react';
import { Printer } from 'lucide-react';
import { get } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { angka } from '@/lib/format';
import type { Khs, Periode } from '@/lib/types';
import { DataState, PageHeader } from '@/components/ui';
import NilaiTable from '@/components/NilaiTable';

const key = (p: Periode) => `${p.semester}|${p.tahunAjaran}`;

export default function KhsPage() {
  const [periode, setPeriode] = useState<Periode | null>(null);
  const { data, error, loading, reload } = useFetch(() => get<Khs>('/nilai/khs', periode ? { ...periode } : undefined), [periode?.semester, periode?.tahunAjaran]);

  return (
    <>
      <PageHeader
        title="Kartu Hasil Studi"
        subtitle={data ? `${data.mahasiswa.namaMhs} · ${data.mahasiswa.nim} · ${data.mahasiswa.jurusan}` : undefined}
        actions={
          <>
            {data && data.periodeList.length > 0 && (
              <select
                className="input w-48"
                aria-label="Periode"
                value={data.periode ? key(data.periode) : ''}
                onChange={(e) => {
                  const [semester, tahunAjaran] = e.target.value.split('|');
                  setPeriode({ semester, tahunAjaran });
                }}
              >
                {data.periodeList.map((p) => (
                  <option key={key(p)} value={key(p)}>
                    {p.semester} {p.tahunAjaran}
                  </option>
                ))}
              </select>
            )}
            <button className="btn-ghost" onClick={() => window.print()} disabled={!data?.items.length}>
              <Printer className="h-4 w-4" /> Cetak
            </button>
          </>
        }
      />
      <DataState loading={loading} error={error} onRetry={reload} empty={!data?.items.length} emptyText="Belum ada nilai yang keluar">
        {data?.periode && (
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-4 px-5 pt-5 pb-3">
              <h2 className="font-semibold text-white">
                Semester {data.periode.semester} {data.periode.tahunAjaran}
              </h2>
              <div className="flex gap-6 text-sm">
                <span className="text-slate-400">
                  SKS <span className="text-white font-semibold ml-1">{data.totalSks}</span>
                </span>
                <span className="text-slate-400">
                  IPS <span className="text-white font-semibold ml-1">{angka(data.ips)}</span>
                </span>
              </div>
            </div>
            <NilaiTable items={data.items} />
          </div>
        )}
      </DataState>
    </>
  );
}
