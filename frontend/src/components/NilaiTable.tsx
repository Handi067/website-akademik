import { angka } from '@/lib/format';
import type { NilaiRow } from '@/lib/types';
import { GradeBadge } from './ui';

/** Shared KHS / transkrip table. */
export default function NilaiTable({ items, showPeriode }: { items: NilaiRow[]; showPeriode?: boolean }) {
  const totalSks = items.reduce((s, i) => s + i.sks, 0);
  const totalMutu = items.reduce((s, i) => s + (i.bobot ?? 0) * i.sks, 0);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Kode</th>
            <th>Mata kuliah</th>
            {showPeriode && <th>Periode</th>}
            <th className="text-right">SKS</th>
            <th className="text-right">Nilai</th>
            <th className="text-center">Huruf</th>
            <th className="text-right">Bobot</th>
            <th className="text-right">Mutu</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={`${i.kodeMk}-${i.semester}-${i.tahunAjaran}`}>
              <td className="font-mono text-slate-300">{i.kodeMk}</td>
              <td className="text-white">{i.namaMk}</td>
              {showPeriode && (
                <td className="text-slate-400">
                  {i.semester} {i.tahunAjaran}
                </td>
              )}
              <td className="text-right">{i.sks}</td>
              <td className="text-right tabular-nums">{angka(i.nilaiAkhir)}</td>
              <td className="text-center">
                <GradeBadge grade={i.grade} />
              </td>
              <td className="text-right tabular-nums">{angka(i.bobot)}</td>
              <td className="text-right tabular-nums">{i.bobot === null ? '–' : angka(i.bobot * i.sks)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-slate-300 font-medium">
            <td colSpan={showPeriode ? 3 : 2} className="px-4 py-3 border-t border-slate-700/70">
              Jumlah
            </td>
            <td className="px-4 py-3 border-t border-slate-700/70 text-right">{totalSks}</td>
            <td colSpan={3} className="px-4 py-3 border-t border-slate-700/70" />
            <td className="px-4 py-3 border-t border-slate-700/70 text-right tabular-nums">{angka(totalMutu)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
