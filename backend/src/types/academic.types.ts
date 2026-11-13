import { 
  Mahasiswa, 
  Dosen, 
  Matakuliah, 
  JadwalKuliah, 
  Krs, 
  Nilai, 
  Pertemuan, 
  Absensi,
  Hari,
  KrsStatus,
  Grade,
  StatusHadir
} from '@prisma/client';

// Mahasiswa Types
export interface CreateMahasiswaRequest {
  nim: string;
  username: string;
  email: string;
  password: string;
  namaMhs: string;
  jurusan: string;
  angkatan: string;
  noHp?: string;
  alamat?: string;
}

export interface UpdateMahasiswaRequest {
  namaMhs?: string;
  jurusan?: string;
  angkatan?: string;
  noHp?: string;
  alamat?: string;
}

export interface MahasiswaResponse extends Omit<Mahasiswa, 'user'> {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

// Dosen Types
export interface CreateDosenRequest {
  nidn: string;
  userId: string;
  namaDosen: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  email?: string;
  noHp?: string;
  departemen?: string;
}

export interface UpdateDosenRequest {
  namaDosen?: string;
  gelarDepan?: string;
  gelarBelakang?: string;
  email?: string;
  noHp?: string;
  departemen?: string;
}

export interface DosenResponse extends Omit<Dosen, 'user'> {
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

// Matakuliah Types
export interface CreateMatakuliahRequest {
  kodeMk: string;
  namaMk: string;
  sks: number;
  semester: string;
  deskripsi?: string;
  kodePrasyarat?: string;
}

export interface UpdateMatakuliahRequest {
  namaMk?: string;
  sks?: number;
  semester?: string;
  deskripsi?: string;
  kodePrasyarat?: string;
}

// Jadwal Kuliah Types
export interface CreateJadwalRequest {
  kodeMk: string;
  nidn: string;
  hari: Hari;
  jamMulai: string;
  jamSelesai: string;
  ruangan: string;
  kelas?: string;
  semester: string;
  tahunAjaran: string;
  kapasitas?: number;
}

export interface UpdateJadwalRequest {
  hari?: Hari;
  jamMulai?: string;
  jamSelesai?: string;
  ruangan?: string;
  kelas?: string;
  semester?: string;
  tahunAjaran?: string;
  kapasitas?: number;
}

export interface JadwalKuliahResponse extends JadwalKuliah {
  matakuliah: {
    kodeMk: string;
    namaMk: string;
    sks: number;
  };
  dosen: {
    nidn: string;
    namaDosen: string;
    gelarDepan?: string;
    gelarBelakang?: string;
  };
}

// KRS Types
export interface AddKrsRequest {
  jadwalId: string;
  semester: string;
  tahunAjaran: string;
}

export interface KrsResponse extends Krs {
  mahasiswa: {
    nim: string;
    namaMhs: string;
    jurusan: string;
  };
  jadwalKuliah: JadwalKuliahResponse;
}

// Nilai Types
export interface CreateNilaiRequest {
  nim: string;
  kodeMk: string;
  tugas?: number;
  uts?: number;
  uas?: number;
  semester: string;
  tahunAjaran: string;
}

export interface UpdateNilaiRequest {
  tugas?: number;
  uts?: number;
  uas?: number;
  semester?: string;
  tahunAjaran?: string;
}

export interface NilaiResponse extends Nilai {
  mahasiswa: {
    nim: string;
    namaMhs: string;
    jurusan: string;
  };
  matakuliah: {
    kodeMk: string;
    namaMk: string;
    sks: number;
  };
}

// Pertemuan Types
export interface CreatePertemuanRequest {
  kodeMk: string;
  nidn: string;
  pertemuanKe: number;
  tanggal: Date;
  topik?: string;
  materi?: string;
}

export interface UpdatePertemuanRequest {
  tanggal?: Date;
  topik?: string;
  materi?: string;
}

// Absensi Types
export interface CreateAbsensiRequest {
  pertemuanId: string;
  nim: string;
  statusHadir: StatusHadir;
  jamMasuk?: Date;
  keterangan?: string;
}

export interface UpdateAbsensiRequest {
  statusHadir?: StatusHadir;
  jamMasuk?: Date;
  keterangan?: string;
}

export interface BulkAbsensiRequest {
  pertemuanId: string;
  absensi: Array<{
    nim: string;
    statusHadir: StatusHadir;
    keterangan?: string;
  }>;
}

export interface AbsensiResponse extends Absensi {
  mahasiswa: {
    nim: string;
    namaMhs: string;
    jurusan: string;
  };
  pertemuan: {
    id: string;
    pertemuanKe: number;
    tanggal: Date;
    topik?: string;
  };
}

// Dashboard Types
export interface DashboardStats {
  totalMahasiswa: number;
  totalDosen: number;
  totalMatakuliah: number;
  totalJadwal: number;
}

export interface MahasiswaStats {
  totalSks: number;
  ipk: number;
  totalMatkul: number;
  matkulLulus: number;
  matkulAktif: number;
}

export interface DosenStats {
  totalMengajar: number;
  totalPertemuan: number;
  jadwalMengajar: JadwalKuliahResponse[];
}

// Analytics Types
export interface GradeDistribution {
  grade: Grade;
  count: number;
  percentage: number;
}

export interface AttendanceStats {
  hadir: number;
  izin: number;
  sakit: number;
  alpa: number;
  total: number;
  percentage: number;
}

export interface AcademicPerformance {
  nim: string;
  namaMhs: string;
  ipk: number;
  totalSks: number;
  gradeDistribution: GradeDistribution[];
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PaginatedRequest {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterRequest {
  semester?: string;
  tahunAjaran?: string;
  jurusan?: string;
  angkatan?: string;
  kodeMk?: string;
  nidn?: string;
}
