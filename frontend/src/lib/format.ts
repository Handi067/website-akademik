import type { Hari } from './types';

export const HARI: Hari[] = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

export const hariLabel = (h: Hari) => h.charAt(0) + h.slice(1).toLowerCase();

export const angka = (n: number | null | undefined, digits = 2) =>
  n === null || n === undefined ? '–' : n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const namaHariIni = (): Hari => HARI[(new Date().getDay() + 6) % 7];
