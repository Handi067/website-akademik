/**
 * Kolom jam (`@db.Time`) disimpan Prisma sebagai Date pada 1970-01-01 UTC.
 * API memakai string "HH:MM".
 */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const parseTime = (hhmm: string): Date => new Date(`1970-01-01T${hhmm}:00.000Z`);

export const formatTime = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;

export const HARI_URUT = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'] as const;

/** Tanggal hari ini menurut zona waktu server (bukan UTC), disimpan sebagai tengah malam UTC untuk kolom @db.Date. */
export const todayDate = (): Date => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};
