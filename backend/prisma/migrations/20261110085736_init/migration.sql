-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DOSEN', 'MAHASISWA');

-- CreateEnum
CREATE TYPE "Hari" AS ENUM ('SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU');

-- CreateEnum
CREATE TYPE "KrsStatus" AS ENUM ('AKTIF', 'BATAL', 'SELESAI');

-- CreateEnum
CREATE TYPE "Grade" AS ENUM ('A', 'B_PLUS', 'B', 'C_PLUS', 'C', 'D', 'E');

-- CreateEnum
CREATE TYPE "StatusHadir" AS ENUM ('HADIR', 'IZIN', 'SAKIT', 'ALPA');

-- CreateEnum
CREATE TYPE "NotifikasiTipe" AS ENUM ('INFO', 'WARNING', 'SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "PeminjamanStatus" AS ENUM ('AKTIF', 'DIKEMBALIKAN', 'TERLAMBAT');

-- CreateEnum
CREATE TYPE "JenisTagihan" AS ENUM ('UKT', 'SPP');

-- CreateEnum
CREATE TYPE "StatusPembayaran" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MAHASISWA',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mahasiswa" (
    "nim" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "nama_mhs" VARCHAR(100) NOT NULL,
    "jurusan" VARCHAR(50) NOT NULL,
    "angkatan" VARCHAR(10) NOT NULL,
    "no_hp" VARCHAR(15),
    "alamat" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mahasiswa_pkey" PRIMARY KEY ("nim")
);

-- CreateTable
CREATE TABLE "dosen" (
    "nidn" VARCHAR(20) NOT NULL,
    "user_id" UUID NOT NULL,
    "nama_dosen" VARCHAR(100) NOT NULL,
    "gelar_depan" VARCHAR(20),
    "gelar_belakang" VARCHAR(50),
    "email" VARCHAR(100),
    "no_hp" VARCHAR(15),
    "departemen" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dosen_pkey" PRIMARY KEY ("nidn")
);

-- CreateTable
CREATE TABLE "matakuliah" (
    "kode_mk" VARCHAR(10) NOT NULL,
    "nama_mk" VARCHAR(100) NOT NULL,
    "sks" INTEGER NOT NULL,
    "semester" VARCHAR(20) NOT NULL,
    "deskripsi" TEXT,
    "kode_prasyarat" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matakuliah_pkey" PRIMARY KEY ("kode_mk")
);

-- CreateTable
CREATE TABLE "jadwal_kuliah" (
    "id" UUID NOT NULL,
    "kode_mk" VARCHAR(10) NOT NULL,
    "nidn" VARCHAR(20) NOT NULL,
    "hari" "Hari" NOT NULL,
    "jam_mulai" TIME NOT NULL,
    "jam_selesai" TIME NOT NULL,
    "ruangan" VARCHAR(20) NOT NULL,
    "kelas" VARCHAR(20),
    "semester" VARCHAR(20) NOT NULL,
    "tahun_ajaran" VARCHAR(10) NOT NULL,
    "kapasitas" INTEGER NOT NULL DEFAULT 40,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jadwal_kuliah_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "krs" (
    "id" TEXT NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "jadwal_id" UUID NOT NULL,
    "semester" VARCHAR(20) NOT NULL,
    "tahun_ajaran" VARCHAR(10) NOT NULL,
    "status" "KrsStatus" NOT NULL DEFAULT 'AKTIF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "krs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nilai" (
    "id" TEXT NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "kode_mk" VARCHAR(10) NOT NULL,
    "tugas" DECIMAL(5,2),
    "uts" DECIMAL(5,2),
    "uas" DECIMAL(5,2),
    "nilai_akhir" DECIMAL(5,2),
    "grade" "Grade",
    "semester" VARCHAR(20) NOT NULL,
    "tahun_ajaran" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nilai_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pertemuan" (
    "id" UUID NOT NULL,
    "kode_mk" VARCHAR(10) NOT NULL,
    "nidn" VARCHAR(20) NOT NULL,
    "pertemuan_ke" INTEGER NOT NULL,
    "tanggal" DATE NOT NULL,
    "topik" VARCHAR(200),
    "materi" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pertemuan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "absensi" (
    "id" TEXT NOT NULL,
    "pertemuan_id" UUID NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "status_hadir" "StatusHadir" NOT NULL,
    "jam_masuk" TIME,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absensi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifikasi" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "judul" VARCHAR(200) NOT NULL,
    "pesan" TEXT NOT NULL,
    "tipe" "NotifikasiTipe" NOT NULL DEFAULT 'INFO',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "user_id" UUID,
    "aksi" VARCHAR(50) NOT NULL,
    "tabel" VARCHAR(50) NOT NULL,
    "record_id" VARCHAR(50),
    "data_lama" JSONB,
    "data_baru" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buku" (
    "kode_buku" VARCHAR(20) NOT NULL,
    "judul" VARCHAR(200) NOT NULL,
    "pengarang" VARCHAR(100) NOT NULL,
    "penerbit" VARCHAR(100) NOT NULL,
    "tahun" INTEGER NOT NULL,
    "isbn" VARCHAR(20),
    "kategori" VARCHAR(50) NOT NULL,
    "jumlah" INTEGER NOT NULL DEFAULT 1,
    "tersedia" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buku_pkey" PRIMARY KEY ("kode_buku")
);

-- CreateTable
CREATE TABLE "peminjaman" (
    "id" TEXT NOT NULL,
    "kode_buku" VARCHAR(20) NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "tanggal_pinjam" DATE NOT NULL,
    "tanggal_kembali" DATE,
    "tenggat" DATE NOT NULL,
    "status" "PeminjamanStatus" NOT NULL DEFAULT 'AKTIF',
    "denda" DECIMAL(10,2) DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peminjaman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tagihan" (
    "id" UUID NOT NULL,
    "nim" VARCHAR(20) NOT NULL,
    "jenis_tagihan" "JenisTagihan" NOT NULL,
    "jumlah" DECIMAL(12,2) NOT NULL,
    "status" "StatusPembayaran" NOT NULL DEFAULT 'PENDING',
    "tenggat_waktu" DATE NOT NULL,
    "keterangan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tagihan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pembayaran" (
    "id" TEXT NOT NULL,
    "tagihan_id" UUID NOT NULL,
    "metode_pembayaran" VARCHAR(50),
    "transaction_id" VARCHAR(100),
    "payment_url" VARCHAR(255),
    "waktu_transaksi" TIMESTAMP(3),
    "status" "StatusPembayaran" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pembayaran_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "mahasiswa_user_id_key" ON "mahasiswa"("user_id");

-- CreateIndex
CREATE INDEX "mahasiswa_nim_idx" ON "mahasiswa"("nim");

-- CreateIndex
CREATE INDEX "mahasiswa_user_id_idx" ON "mahasiswa"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_user_id_key" ON "dosen"("user_id");

-- CreateIndex
CREATE INDEX "dosen_nidn_idx" ON "dosen"("nidn");

-- CreateIndex
CREATE INDEX "dosen_user_id_idx" ON "dosen"("user_id");

-- CreateIndex
CREATE INDEX "matakuliah_kode_mk_idx" ON "matakuliah"("kode_mk");

-- CreateIndex
CREATE INDEX "jadwal_kuliah_kode_mk_idx" ON "jadwal_kuliah"("kode_mk");

-- CreateIndex
CREATE INDEX "jadwal_kuliah_nidn_idx" ON "jadwal_kuliah"("nidn");

-- CreateIndex
CREATE INDEX "jadwal_kuliah_semester_tahun_ajaran_idx" ON "jadwal_kuliah"("semester", "tahun_ajaran");

-- CreateIndex
CREATE INDEX "krs_nim_idx" ON "krs"("nim");

-- CreateIndex
CREATE INDEX "krs_jadwal_id_idx" ON "krs"("jadwal_id");

-- CreateIndex
CREATE UNIQUE INDEX "krs_nim_jadwal_id_semester_tahun_ajaran_key" ON "krs"("nim", "jadwal_id", "semester", "tahun_ajaran");

-- CreateIndex
CREATE INDEX "nilai_nim_idx" ON "nilai"("nim");

-- CreateIndex
CREATE INDEX "nilai_kode_mk_idx" ON "nilai"("kode_mk");

-- CreateIndex
CREATE UNIQUE INDEX "nilai_nim_kode_mk_semester_tahun_ajaran_key" ON "nilai"("nim", "kode_mk", "semester", "tahun_ajaran");

-- CreateIndex
CREATE INDEX "absensi_pertemuan_id_idx" ON "absensi"("pertemuan_id");

-- CreateIndex
CREATE INDEX "absensi_nim_idx" ON "absensi"("nim");

-- CreateIndex
CREATE UNIQUE INDEX "absensi_pertemuan_id_nim_key" ON "absensi"("pertemuan_id", "nim");

-- CreateIndex
CREATE INDEX "notifikasi_user_id_idx" ON "notifikasi"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_user_id_idx" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "audit_log_tabel_idx" ON "audit_log"("tabel");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "buku_kode_buku_idx" ON "buku"("kode_buku");

-- CreateIndex
CREATE INDEX "peminjaman_kode_buku_idx" ON "peminjaman"("kode_buku");

-- CreateIndex
CREATE INDEX "peminjaman_nim_idx" ON "peminjaman"("nim");

-- CreateIndex
CREATE INDEX "tagihan_nim_idx" ON "tagihan"("nim");

-- CreateIndex
CREATE INDEX "tagihan_status_idx" ON "tagihan"("status");

-- CreateIndex
CREATE INDEX "pembayaran_tagihan_id_idx" ON "pembayaran"("tagihan_id");

-- CreateIndex
CREATE INDEX "pembayaran_transaction_id_idx" ON "pembayaran"("transaction_id");

-- AddForeignKey
ALTER TABLE "mahasiswa" ADD CONSTRAINT "mahasiswa_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dosen" ADD CONSTRAINT "dosen_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matakuliah" ADD CONSTRAINT "matakuliah_kode_prasyarat_fkey" FOREIGN KEY ("kode_prasyarat") REFERENCES "matakuliah"("kode_mk") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_kuliah" ADD CONSTRAINT "jadwal_kuliah_kode_mk_fkey" FOREIGN KEY ("kode_mk") REFERENCES "matakuliah"("kode_mk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jadwal_kuliah" ADD CONSTRAINT "jadwal_kuliah_nidn_fkey" FOREIGN KEY ("nidn") REFERENCES "dosen"("nidn") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "krs" ADD CONSTRAINT "krs_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "krs" ADD CONSTRAINT "krs_jadwal_id_fkey" FOREIGN KEY ("jadwal_id") REFERENCES "jadwal_kuliah"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nilai" ADD CONSTRAINT "nilai_kode_mk_fkey" FOREIGN KEY ("kode_mk") REFERENCES "matakuliah"("kode_mk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan" ADD CONSTRAINT "pertemuan_kode_mk_fkey" FOREIGN KEY ("kode_mk") REFERENCES "matakuliah"("kode_mk") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pertemuan" ADD CONSTRAINT "pertemuan_nidn_fkey" FOREIGN KEY ("nidn") REFERENCES "dosen"("nidn") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_pertemuan_id_fkey" FOREIGN KEY ("pertemuan_id") REFERENCES "pertemuan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absensi" ADD CONSTRAINT "absensi_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifikasi" ADD CONSTRAINT "notifikasi_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peminjaman" ADD CONSTRAINT "peminjaman_kode_buku_fkey" FOREIGN KEY ("kode_buku") REFERENCES "buku"("kode_buku") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peminjaman" ADD CONSTRAINT "peminjaman_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tagihan" ADD CONSTRAINT "tagihan_nim_fkey" FOREIGN KEY ("nim") REFERENCES "mahasiswa"("nim") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pembayaran" ADD CONSTRAINT "pembayaran_tagihan_id_fkey" FOREIGN KEY ("tagihan_id") REFERENCES "tagihan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
