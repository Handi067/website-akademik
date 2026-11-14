import { Grade } from '@prisma/client';
import { hitungIp, hitungNilaiAkhir, isLulus, toGrade, toNumber } from '@/utils/grading';
import { formatTime, parseTime, todayDate } from '@/utils/time';

describe('hitungNilaiAkhir', () => {
  it('memakai bobot tugas 30%, UTS 30%, UAS 40%', () => {
    expect(hitungNilaiAkhir(80, 70, 90)).toBe(81);
    expect(hitungNilaiAkhir(85, 80, 90)).toBe(85.5);
  });

  it('dibulatkan 2 desimal', () => {
    expect(hitungNilaiAkhir(33.33, 33.33, 33.33)).toBe(33.33);
  });

  it('null bila ada komponen yang belum diisi', () => {
    expect(hitungNilaiAkhir(null, 80, 80)).toBeNull();
    expect(hitungNilaiAkhir(80, null, 80)).toBeNull();
    expect(hitungNilaiAkhir(80, 80, null)).toBeNull();
  });

  it('nilai 0 dihitung, bukan dianggap kosong', () => {
    expect(hitungNilaiAkhir(0, 0, 0)).toBe(0);
  });
});

describe('toGrade', () => {
  it.each([
    [100, Grade.A],
    [85, Grade.A],
    [84.99, Grade.B_PLUS],
    [80, Grade.B_PLUS],
    [79.99, Grade.B],
    [70, Grade.B],
    [65, Grade.C_PLUS],
    [55, Grade.C],
    [54.99, Grade.D],
    [40, Grade.D],
    [39.99, Grade.E],
    [0, Grade.E],
  ])('%p → %p (batas bawah inklusif)', (nilai, grade) => {
    expect(toGrade(nilai)).toBe(grade);
  });
});

describe('isLulus', () => {
  it('semua grade kecuali E lulus', () => {
    expect(isLulus(Grade.D)).toBe(true);
    expect(isLulus(Grade.E)).toBe(false);
    expect(isLulus(null)).toBe(false);
    expect(isLulus(undefined)).toBe(false);
  });
});

describe('hitungIp', () => {
  it('rata-rata tertimbang SKS', () => {
    // (3×4 + 4×3) / 7 = 3.428… → 3.43
    expect(hitungIp([{ sks: 3, grade: Grade.A }, { sks: 4, grade: Grade.B }])).toEqual({ totalSks: 7, ip: 3.43 });
  });

  it('mengabaikan baris tanpa grade', () => {
    expect(hitungIp([{ sks: 3, grade: Grade.A }, { sks: 4, grade: null }])).toEqual({ totalSks: 3, ip: 4 });
  });

  it('IP 0 bila belum ada nilai (tanpa pembagian nol)', () => {
    expect(hitungIp([])).toEqual({ totalSks: 0, ip: 0 });
  });

  it('grade E tetap dihitung dengan bobot 0', () => {
    expect(hitungIp([{ sks: 2, grade: Grade.A }, { sks: 2, grade: Grade.E }])).toEqual({ totalSks: 4, ip: 2 });
  });
});

describe('toNumber', () => {
  it('mengubah Decimal Prisma (punya toString) menjadi number', () => {
    expect(toNumber({ toString: () => '85.50' })).toBe(85.5);
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe('waktu', () => {
  it('parseTime/formatTime bolak-balik HH:MM', () => {
    expect(formatTime(parseTime('08:30'))).toBe('08:30');
    expect(formatTime(parseTime('23:59'))).toBe('23:59');
  });

  it('todayDate = tanggal lokal hari ini pada tengah malam UTC', () => {
    const now = new Date();
    const d = todayDate();
    expect(d.getUTCHours()).toBe(0);
    expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]).toEqual([now.getFullYear(), now.getMonth(), now.getDate()]);
  });
});
