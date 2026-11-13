import { Grade } from '@prisma/client';

/** Bobot komponen nilai akhir. */
export const BOBOT_KOMPONEN = { tugas: 0.3, uts: 0.3, uas: 0.4 } as const;

export const GRADE_BOBOT: Record<Grade, number> = {
  A: 4,
  B_PLUS: 3.5,
  B: 3,
  C_PLUS: 2.5,
  C: 2,
  D: 1,
  E: 0,
};

export const GRADE_LABEL: Record<Grade, string> = {
  A: 'A',
  B_PLUS: 'B+',
  B: 'B',
  C_PLUS: 'C+',
  C: 'C',
  D: 'D',
  E: 'E',
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nilai akhir 0–100, atau null bila ada komponen yang belum diisi. */
export const hitungNilaiAkhir = (
  tugas: number | null,
  uts: number | null,
  uas: number | null
): number | null => {
  if (tugas === null || uts === null || uas === null) return null;
  return round2(tugas * BOBOT_KOMPONEN.tugas + uts * BOBOT_KOMPONEN.uts + uas * BOBOT_KOMPONEN.uas);
};

export const toGrade = (nilaiAkhir: number): Grade => {
  if (nilaiAkhir >= 85) return Grade.A;
  if (nilaiAkhir >= 80) return Grade.B_PLUS;
  if (nilaiAkhir >= 70) return Grade.B;
  if (nilaiAkhir >= 65) return Grade.C_PLUS;
  if (nilaiAkhir >= 55) return Grade.C;
  if (nilaiAkhir >= 40) return Grade.D;
  return Grade.E;
};

export const isLulus = (grade: Grade | null | undefined): boolean => !!grade && grade !== Grade.E;

/** Indeks prestasi tertimbang SKS; hanya baris yang sudah punya grade yang dihitung. */
export const hitungIp = (rows: { sks: number; grade: Grade | null }[]) => {
  const graded = rows.filter((r): r is { sks: number; grade: Grade } => r.grade !== null);
  const totalSks = graded.reduce((s, r) => s + r.sks, 0);
  const mutu = graded.reduce((s, r) => s + r.sks * GRADE_BOBOT[r.grade], 0);
  return { totalSks, ip: totalSks ? round2(mutu / totalSks) : 0 };
};

export const toNumber = (v: { toString(): string } | null | undefined): number | null =>
  v === null || v === undefined ? null : Number(v.toString());
