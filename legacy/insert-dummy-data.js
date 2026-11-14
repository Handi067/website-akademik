const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function insertDummyData() {
    try {
        // Insert dummy nilai
        await pool.query(`
            INSERT INTO nilai (nim, kode_mk, nilai, semester, tahun_ajaran) VALUES
            ('2023001', 'SI101', 85.5, 'Ganjil', '2023/2024'),
            ('2023001', 'SI205', 78.0, 'Ganjil', '2023/2024'),
            ('2023002', 'SI101', 92.5, 'Genap', '2023/2024'),
            ('2023002', 'SI205', 88.0, 'Genap', '2023/2024')
            ON CONFLICT DO NOTHING
        `);

        // Insert dummy buku
        await pool.query(`
            INSERT INTO buku (kode_buku, judul, pengarang, penerbit, tahun_terbit, jumlah_eksemplar, tersedia) VALUES
            ('BK001', 'Pemrograman Web Modern', 'John Doe', 'PT Tech Books', 2023, 5, 3),
            ('BK002', 'Database Design', 'Jane Smith', 'Academic Press', 2022, 3, 3),
            ('BK003', 'Algoritma dan Struktur Data', 'Bob Johnson', 'Tech Edu', 2021, 4, 2)
            ON CONFLICT DO NOTHING
        `);

        // Insert dummy peminjaman
        await pool.query(`
            INSERT INTO peminjaman (nim, kode_buku, tanggal_pinjam, status) VALUES
            ('2023001', 'BK001', CURRENT_DATE - INTERVAL '5 days', 'dipinjam'),
            ('2023002', 'BK002', CURRENT_DATE - INTERVAL '3 days', 'dipinjam')
            ON CONFLICT DO NOTHING
        `);

        // Insert dummy jadwal
        await pool.query(`
            INSERT INTO jadwal_kuliah (kode_mk, hari, jam_mulai, jam_selesai, ruangan, semester, tahun_ajaran) VALUES
            ('SI101', 'Senin', '08:00', '10:00', 'Lab Komputer 1', 'Ganjil', '2024/2025'),
            ('SI205', 'Selasa', '10:00', '12:00', 'Ruang 201', 'Ganjil', '2024/2025'),
            ('SI101', 'Rabu', '13:00', '15:00', 'Lab Komputer 2', 'Ganjil', '2024/2025'),
            ('SI205', 'Kamis', '09:00', '11:00', 'Ruang 202', 'Ganjil', '2024/2025')
            ON CONFLICT DO NOTHING
        `);

        console.log('Data dummy berhasil dimasukkan');
    } catch (err) {
        console.error('Error inserting dummy data:', err);
    } finally {
        pool.end();
    }
}

insertDummyData();