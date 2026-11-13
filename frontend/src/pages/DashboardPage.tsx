import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, BookOpen, CalendarDays, ClipboardList, GraduationCap, Layers, UserCog, Users } from 'lucide-react';
import { get } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import { angka, hariLabel, namaHariIni } from '@/lib/format';
import type { Dashboard, Jadwal } from '@/lib/types';
import { DataState, PageHeader, StatCard } from '@/components/ui';

const BAR = '#10b981';

function SingleSeriesBar({ title, data, x, y, unit }: { title: string; data: object[]; x: string; y: string; unit: string }) {
  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-white mb-4">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 py-12 text-center">Belum ada data</p>
      ) : (
        <div className="h-56" role="img" aria-label={title}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="0" strokeOpacity={0.5} />
              <XAxis dataKey={x} tickLine={false} axisLine={{ stroke: '#334155' }} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: 'rgba(148,163,184,0.08)' }}
                contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#e2e8f0' }}
                itemStyle={{ color: '#cbd5e1' }}
                formatter={(v: number) => [`${v} ${unit}`, '']}
                separator=""
              />
              <Bar dataKey={y} fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function JadwalList({ jadwal, title }: { jadwal: Jadwal[]; title: string }) {
  const hariIni = namaHariIni();
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <Link to="/app/jadwal" className="text-xs text-primary-500 hover:underline">
          Lihat semua
        </Link>
      </div>
      {jadwal.length === 0 ? (
        <p className="text-sm text-slate-500 px-5 pb-6">Belum ada jadwal pada periode ini.</p>
      ) : (
        <ul className="divide-y divide-slate-800">
          {jadwal.map((j) => (
            <li key={j.id} className="px-5 py-3 flex items-center gap-4">
              <div className={`w-20 shrink-0 text-xs font-medium ${j.hari === hariIni ? 'text-primary-500' : 'text-slate-400'}`}>
                {hariLabel(j.hari)}
                <div className="text-slate-500 font-normal">
                  {j.jamMulai}–{j.jamSelesai}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">
                  {j.namaMk} <span className="text-slate-500">· {j.sks} SKS</span>
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {j.ruangan} · {j.namaDosen}
                </p>
              </div>
              {j.hari === hariIni && <span className="badge bg-primary-500/15 text-primary-500">Hari ini</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data, error, loading, reload } = useFetch(() => get<Dashboard>('/dashboard'), []);
  const periode = data ? `Periode ${data.periode.semester} ${data.periode.tahunAjaran}` : undefined;

  return (
    <>
      <PageHeader
        title={data?.role === 'MAHASISWA' ? `Halo, ${data.profil.namaMhs}` : data?.role === 'DOSEN' ? `Halo, ${data.profil.namaDosen}` : 'Dashboard'}
        subtitle={periode}
      />
      <DataState loading={loading} error={error} onRetry={reload}>
        {data?.role === 'ADMIN' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Mahasiswa" value={data.totals.mahasiswa} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Dosen" value={data.totals.dosen} icon={<UserCog className="h-5 w-5" />} />
              <StatCard label="Mata kuliah" value={data.totals.matakuliah} icon={<BookOpen className="h-5 w-5" />} />
              <StatCard
                label="Kelas periode ini"
                value={data.totals.jadwal}
                hint={`${data.totals.krsAktif} pengambilan KRS`}
                icon={<CalendarDays className="h-5 w-5" />}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SingleSeriesBar title="Mahasiswa per angkatan" data={data.mahasiswaPerAngkatan} x="angkatan" y="jumlah" unit="mahasiswa" />
              <SingleSeriesBar title="Distribusi nilai huruf" data={data.distribusiGrade} x="grade" y="jumlah" unit="nilai" />
            </div>
          </div>
        )}

        {data?.role === 'DOSEN' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Kelas diampu" value={data.totals.kelas} icon={<Layers className="h-5 w-5" />} />
              <StatCard label="Total mahasiswa" value={data.totals.mahasiswa} icon={<Users className="h-5 w-5" />} />
              <StatCard label="Beban SKS" value={data.totals.sks} icon={<BookOpen className="h-5 w-5" />} />
            </div>
            <JadwalList jadwal={data.jadwal} title="Jadwal mengajar" />
          </div>
        )}

        {data?.role === 'MAHASISWA' && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="IPK" value={angka(data.totals.ipk)} icon={<Award className="h-5 w-5" />} hint={`${data.profil.nim} · ${data.profil.jurusan}`} />
              <StatCard label="SKS lulus" value={data.totals.sksLulus} icon={<GraduationCap className="h-5 w-5" />} />
              <StatCard
                label="SKS semester ini"
                value={`${data.totals.sksSemesterIni} / ${data.totals.maxSks}`}
                icon={<ClipboardList className="h-5 w-5" />}
                hint={data.totals.sksSemesterIni === 0 ? 'KRS belum diisi' : undefined}
              />
            </div>
            {data.totals.sksSemesterIni === 0 && (
              <div className="card p-5 flex flex-wrap items-center justify-between gap-3 border-primary-500/40">
                <p className="text-sm text-slate-300">Anda belum mengambil mata kuliah untuk periode ini.</p>
                <Link to="/app/krs" className="btn-solid">
                  Isi KRS
                </Link>
              </div>
            )}
            <JadwalList jadwal={data.jadwal} title="Jadwal kuliah saya" />
          </div>
        )}
      </DataState>
    </>
  );
}
