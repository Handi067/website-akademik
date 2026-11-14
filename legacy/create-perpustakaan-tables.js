const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function createPerpustakaanTables() {
    try {
        // Tabel buku
        await pool.query(`
            CREATE TABLE IF NOT EXISTS buku (
                kode_buku VARCHAR(20) PRIMARY KEY,
                judul VARCHAR(200) NOT NULL,
                pengarang VARCHAR(100),
                penerbit VARCHAR(100),
                tahun_terbit INTEGER,
                jumlah_eksemplar INTEGER DEFAULT 1,
                tersedia INTEGER DEFAULT 1
            )
        `);

        // Tabel peminjaman
        await pool.query(`
            CREATE TABLE IF NOT EXISTS peminjaman (
                id SERIAL PRIMARY KEY,
                nim VARCHAR(20) REFERENCES mahasiswa(nim),
                kode_buku VARCHAR(20) REFERENCES buku(kode_buku),
                tanggal_pinjam DATE DEFAULT CURRENT_DATE,
                tanggal_kembali DATE,
                status VARCHAR(20) DEFAULT 'dipinjam' -- dipinjam, dikembalikan, terlambat
            )
        `);

        console.log('Tabel perpustakaan berhasil dibuat');
    } catch (err) {
        console.error('Error creating perpustakaan tables:', err);
    } finally {
        pool.end();
    }
}

createPerpustakaanTables();