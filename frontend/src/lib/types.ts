export type Role = 'ADMIN' | 'DOSEN' | 'MAHASISWA';
export type Hari = 'SENIN' | 'SELASA' | 'RABU' | 'KAMIS' | 'JUMAT' | 'SABTU' | 'MINGGU';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  error?: string;
  pagination?: { page: number; limit: number; total: number; totalPages: number };
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
}

export interface Periode {
  semester: string;
  tahunAjaran: string;
}

export interface Mahasiswa {
  nim: string;
  namaMhs: string;
  jurusan: string;
  angkatan: string;
  noHp: string | null;
  alamat: string | null;
  user: { id: string; username: string; email: string };
}

export interface Dosen {
  nidn: string;
  namaDosen: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  email: string | null;
  noHp: string | null;
  departemen: string | null;
  user: { id: string; username: string; isActive: boolean };
  _count: { jadwalKuliah: number };
}

export interface Matakuliah {
  kodeMk: string;
  namaMk: string;
  sks: number;
  semester: string;
  deskripsi: string | null;
  kodePrasyarat: string | null;
  prasyarat: { kodeMk: string; namaMk: string } | null;
  jumlahJadwal: number;
}

export interface Jadwal {
  id: string;
  kodeMk: string;
  namaMk: string;
  sks: number;
  nidn: string;
  namaDosen: string;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruangan: string;
  kelas: string | null;
  semester: string;
  tahunAjaran: string;
  kapasitas: number;
  terisi: number;
}

export interface KrsItem extends Jadwal {
  krsId: string;
}

export interface Penawaran extends Jadwal {
  kodePrasyarat: string | null;
  prasyaratTerpenuhi: boolean;
  diambil: boolean;
}

export interface Krs {
  periode: Periode;
  editable: boolean;
  totalSks: number;
  maxSks: number;
  items: KrsItem[];
}

export interface NilaiRow {
  kodeMk: string;
  namaMk: string;
  sks: number;
  tugas: number | null;
  uts: number | null;
  uas: number | null;
  nilaiAkhir: number | null;
  grade: string | null;
  bobot: number | null;
  semester: string;
  tahunAjaran: string;
}

export interface MhsRingkas {
  nim: string;
  namaMhs: string;
  jurusan: string;
  angkatan: string;
}

export interface Khs {
  mahasiswa: MhsRingkas;
  periodeList: Periode[];
  periode: Periode | null;
  items: NilaiRow[];
  ips: number;
  totalSks: number;
}

export interface Transkrip {
  mahasiswa: MhsRingkas;
  items: NilaiRow[];
  ipk: number;
  totalSks: number;
}

export interface PesertaNilai {
  nim: string;
  namaMhs: string;
  tugas: number | null;
  uts: number | null;
  uas: number | null;
  nilaiAkhir: number | null;
  grade: string | null;
}

export interface NilaiKelas {
  jadwal: Jadwal;
  peserta: PesertaNilai[];
}

export type Dashboard =
  | {
      role: 'ADMIN';
      periode: Periode;
      totals: { mahasiswa: number; dosen: number; matakuliah: number; jadwal: number; krsAktif: number };
      mahasiswaPerAngkatan: { angkatan: string; jumlah: number }[];
      distribusiGrade: { grade: string; jumlah: number }[];
    }
  | {
      role: 'DOSEN';
      periode: Periode;
      profil: { nidn: string; namaDosen: string; departemen: string | null };
      totals: { kelas: number; mahasiswa: number; sks: number };
      jadwal: Jadwal[];
    }
  | {
      role: 'MAHASISWA';
      periode: Periode;
      profil: MhsRingkas;
      totals: { ipk: number; sksLulus: number; sksSemesterIni: number; maxSks: number };
      jadwal: KrsItem[];
    };

export type StatusHadir = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPA';

export interface RekapHadir {
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPA: number;
  persentase: number | null;
}

export interface PertemuanRow {
  id: string;
  pertemuanKe: number;
  tanggal: string;
  topik: string | null;
  materi: string | null;
  jumlahHadir: number;
}

export interface AbsensiKelas {
  jadwal: Jadwal;
  pertemuan: PertemuanRow[];
  peserta: ({ nim: string; namaMhs: string } & RekapHadir)[];
}

export interface LembarAbsensi {
  pertemuan: { id: string; kodeMk: string; namaMk: string; pertemuanKe: number; tanggal: string; topik: string | null };
  peserta: { nim: string; namaMhs: string; statusHadir: StatusHadir | null; keterangan: string | null }[];
}

export interface RekapAbsensiMk extends RekapHadir {
  jadwalId: string;
  kodeMk: string;
  namaMk: string;
  namaDosen: string;
  totalPertemuan: number;
  detail: { pertemuanKe: number; tanggal: string; topik: string | null; statusHadir: StatusHadir | null; keterangan: string | null }[];
}

export type StatusPembayaran = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export interface Tagihan {
  id: string;
  nim: string;
  namaMhs: string;
  jurusan: string;
  jenisTagihan: 'UKT' | 'SPP';
  jumlah: number;
  status: StatusPembayaran;
  tenggatWaktu: string;
  terlambat: boolean;
  keterangan: string | null;
  menungguVerifikasi: boolean;
  pembayaran: {
    id: string;
    metodePembayaran: string | null;
    nomorReferensi: string | null;
    waktuTransaksi: string | null;
    status: StatusPembayaran;
  }[];
}

export interface Buku {
  kodeBuku: string;
  judul: string;
  pengarang: string;
  penerbit: string;
  tahun: number;
  isbn: string | null;
  kategori: string;
  jumlah: number;
  tersedia: number;
}

export interface Peminjaman {
  id: string;
  kodeBuku: string;
  judul: string;
  pengarang: string;
  nim: string;
  namaMhs: string;
  tanggalPinjam: string;
  tenggat: string;
  tanggalKembali: string | null;
  status: 'AKTIF' | 'TERLAMBAT' | 'DIKEMBALIKAN';
  terlambatHari: number;
  denda: number;
}
