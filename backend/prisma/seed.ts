import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';
import { hitungNilaiAkhir, toGrade } from '../src/utils/grading';
import { parseTime } from '../src/utils/time';

const AKTIF = { semester: 'Ganjil', tahunAjaran: '2025/2026' };

const nilai = (nim: string, kodeMk: string, tugas: number, uts: number, uas: number, semester: string, tahunAjaran: string) => {
  const nilaiAkhir = hitungNilaiAkhir(tugas, uts, uas)!;
  return { nim, kodeMk, tugas, uts, uas, nilaiAkhir, grade: toGrade(nilaiAkhir), semester, tahunAjaran };
};

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Guard: the legacy EJS app's database shares table names (users, krs, nilai, ...).
  // Seeding wipes those tables, so refuse to run against it.
  const legacy = await prisma.$queryRaw<{ n: number }[]>`
    select count(*)::int as n from information_schema.tables
    where table_schema = 'public' and table_name in ('tugas', 'absen', 'jawaban_tugas')`;
  if (legacy[0].n > 0) {
    throw new Error('DATABASE_URL points to the legacy app database (found tugas/absen tables). Refusing to seed.');
  }

  // Clean existing data
  await prisma.pembayaran.deleteMany();
  await prisma.tagihan.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notifikasi.deleteMany();
  await prisma.absensi.deleteMany();
  await prisma.peminjaman.deleteMany();
  await prisma.pertemuan.deleteMany();
  await prisma.nilai.deleteMany();
  await prisma.krs.deleteMany();
  await prisma.jadwalKuliah.deleteMany();
  await prisma.buku.deleteMany();
  await prisma.matakuliah.deleteMany();
  await prisma.mahasiswa.deleteMany();
  await prisma.dosen.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing data');

  // Create Admin User
  const adminPassword = await hashPassword('admin123');
  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@academic.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  // Create Dosen Users
  const dosenPassword = await hashPassword('dosen123');
  const dosen1 = await prisma.user.create({
    data: {
      username: 'dosen1',
      email: 'dosen1@academic.com',
      passwordHash: dosenPassword,
      role: 'DOSEN',
    },
  });

  const dosen2 = await prisma.user.create({
    data: {
      username: 'dosen2',
      email: 'dosen2@academic.com',
      passwordHash: dosenPassword,
      role: 'DOSEN',
    },
  });

  // Create Mahasiswa Users
  const mahasiswaPassword = await hashPassword('mahasiswa123');
  const mhs1 = await prisma.user.create({
    data: {
      username: 'mahasiswa1',
      email: 'mahasiswa1@academic.com',
      passwordHash: mahasiswaPassword,
      role: 'MAHASISWA',
    },
  });

  const mhs2 = await prisma.user.create({
    data: {
      username: 'mahasiswa2',
      email: 'mahasiswa2@academic.com',
      passwordHash: mahasiswaPassword,
      role: 'MAHASISWA',
    },
  });

  // Create Dosen Profiles
  await prisma.dosen.create({
    data: {
      nidn: '1234567890',
      userId: dosen1.id,
      namaDosen: 'Dr. Ahmad Wijaya, S.Kom., M.Kom.',
      gelarDepan: 'Dr.',
      gelarBelakang: 'S.Kom., M.Kom.',
      email: 'ahmad.wijaya@academic.com',
      noHp: '081234567890',
      departemen: 'Teknik Informatika',
    },
  });

  await prisma.dosen.create({
    data: {
      nidn: '0987654321',
      userId: dosen2.id,
      namaDosen: 'Siti Nurhaliza, S.T., M.T.',
      gelarBelakang: 'S.T., M.T.',
      email: 'siti.nurhaliza@academic.com',
      noHp: '082345678901',
      departemen: 'Teknik Informatika',
    },
  });

  // Create Mahasiswa Profiles
  await prisma.mahasiswa.create({
    data: {
      nim: '2021001001',
      userId: mhs1.id,
      namaMhs: 'Budi Santoso',
      jurusan: 'Teknik Informatika',
      angkatan: '2021',
      noHp: '083456789012',
      alamat: 'Jl. Merdeka No. 123, Jakarta',
    },
  });

  await prisma.mahasiswa.create({
    data: {
      nim: '2021001002',
      userId: mhs2.id,
      namaMhs: 'Anisa Putri',
      jurusan: 'Teknik Informatika',
      angkatan: '2021',
      noHp: '084567890123',
      alamat: 'Jl. Sudirman No. 456, Bandung',
    },
  });

  // Create Mata Kuliah
  await prisma.matakuliah.create({
    data: {
      kodeMK: 'IF101',
      namaMk: 'Pemrograman Dasar',
      sks: 3,
      semester: '1',
      deskripsi: 'Mata kuliah pengantar pemrograman komputer',
    },
  });

  await prisma.matakuliah.create({
    data: {
      kodeMK: 'IF102',
      namaMk: 'Algoritma dan Struktur Data',
      sks: 4,
      semester: '2',
      deskripsi: 'Pembahasan algoritma dan struktur data',
      kodePrasyarat: 'IF101',
    },
  });

  await prisma.matakuliah.create({
    data: {
      kodeMK: 'IF103',
      namaMk: 'Basis Data',
      sks: 3,
      semester: '3',
      deskripsi: 'Pengantar basis data dan SQL',
      kodePrasyarat: 'IF102',
    },
  });

  await prisma.matakuliah.create({
    data: {
      kodeMK: 'IF104',
      namaMk: 'Rekayasa Perangkat Lunak',
      sks: 3,
      semester: '4',
      deskripsi: 'Prinsip-prinsip rekayasa perangkat lunak',
      kodePrasyarat: 'IF102',
    },
  });

  // Create Jadwal Kuliah
  await prisma.jadwalKuliah.create({
    data: {
      kodeMk: 'IF101',
      nidn: '1234567890',
      hari: 'SENIN',
      jamMulai: parseTime('08:00'),
      jamSelesai: parseTime('10:30'),
      ruangan: 'Lab-301',
      kelas: 'IF-2021-A',
      ...AKTIF,
      kapasitas: 30,
    },
  });

  const jadwal2 = await prisma.jadwalKuliah.create({
    data: {
      kodeMk: 'IF102',
      nidn: '0987654321',
      hari: 'SELASA',
      jamMulai: parseTime('13:00'),
      jamSelesai: parseTime('15:30'),
      ruangan: 'Lab-302',
      kelas: 'IF-2021-A',
      ...AKTIF,
      kapasitas: 30,
    },
  });

  const jadwal3 = await prisma.jadwalKuliah.create({
    data: {
      kodeMk: 'IF103',
      nidn: '1234567890',
      hari: 'RABU',
      jamMulai: parseTime('10:00'),
      jamSelesai: parseTime('12:30'),
      ruangan: 'Lab-303',
      kelas: 'IF-2021-A',
      ...AKTIF,
      kapasitas: 30,
    },
  });

  await prisma.jadwalKuliah.create({
    data: {
      kodeMk: 'IF104',
      nidn: '0987654321',
      hari: 'KAMIS',
      jamMulai: parseTime('08:00'),
      jamSelesai: parseTime('10:30'),
      ruangan: 'R-201',
      kelas: 'IF-2021-A',
      ...AKTIF,
      kapasitas: 2,
    },
  });

  // Create KRS
  // KRS periode aktif: mahasiswa1 sudah lulus IF102 → boleh ambil IF103; mahasiswa2 baru lulus IF101 → ambil IF102
  await prisma.krs.createMany({
    data: [
      { nim: '2021001001', jadwalId: jadwal3.id, ...AKTIF, status: 'AKTIF' },
      { nim: '2021001002', jadwalId: jadwal2.id, ...AKTIF, status: 'AKTIF' },
    ],
  });

  // Riwayat nilai (tahun ajaran sebelumnya)
  await prisma.nilai.createMany({
    data: [
      nilai('2021001001', 'IF101', 85, 80, 90, 'Ganjil', '2024/2025'),
      nilai('2021001001', 'IF102', 75, 85, 80, 'Genap', '2024/2025'),
      nilai('2021001002', 'IF101', 90, 85, 95, 'Ganjil', '2024/2025'),
    ],
  });

  // Create Pertemuan
  await prisma.pertemuan.createMany({
    data: [
      {
        kodeMk: 'IF101',
        nidn: '1234567890',
        pertemuanKe: 1,
        tanggal: new Date('2025-09-01'),
        topik: 'Pengantar Pemrograman dan Algoritma',
        materi: 'Konsep dasar pemrograman, variabel, tipe data',
      },
      {
        kodeMk: 'IF101',
        nidn: '1234567890',
        pertemuanKe: 2,
        tanggal: new Date('2025-09-08'),
        topik: 'Struktur Kontrol',
        materi: 'Percabangan dan perulangan',
      },
      {
        kodeMk: 'IF102',
        nidn: '0987654321',
        pertemuanKe: 1,
        tanggal: new Date('2025-09-02'),
        topik: 'Pengantar Algoritma',
        materi: 'Definisi algoritma, notasi algoritma',
      },
    ],
  });

  // Create Buku Perpustakaan
  await prisma.buku.createMany({
    data: [
      {
        kodeBuku: 'BK001',
        judul: 'Algoritma dan Pemrograman',
        pengarang: 'Tim Dosen TI',
        penerbit: 'Penerbit Akademik',
        tahun: 2022,
        isbn: '978-602-123-456-0',
        kategori: 'Pemrograman',
        jumlah: 5,
        tersedia: 3,
      },
      {
        kodeBuku: 'BK002',
        judul: 'Struktur Data',
        pengarang: 'Prof. Dr. Budi Raharjo',
        penerbit: 'Penerbit Informatika',
        tahun: 2021,
        isbn: '978-602-234-567-1',
        kategori: 'Struktur Data',
        jumlah: 3,
        tersedia: 2,
      },
      {
        kodeBuku: 'BK003',
        judul: 'Basis Data Modern',
        pengarang: 'Dr. Siti Aminah',
        penerbit: 'Penerbit Teknologi',
        tahun: 2023,
        isbn: '978-602-345-678-2',
        kategori: 'Basis Data',
        jumlah: 4,
        tersedia: 4,
      },
    ],
  });

  console.log('✅ Database seeding completed successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('Admin: admin / admin123');
  console.log('Dosen 1: dosen1 / dosen123');
  console.log('Dosen 2: dosen2 / dosen123');
  console.log('Mahasiswa 1: mahasiswa1 / mahasiswa123');
  console.log('Mahasiswa 2: mahasiswa2 / mahasiswa123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
