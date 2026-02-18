const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function createJadwalTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS jadwal_kuliah (
                id SERIAL PRIMARY KEY,
                kode_mk VARCHAR(10) REFERENCES matakuliah(kode_mk),
                hari VARCHAR(10), -- Senin, Selasa, dll
                jam_mulai TIME,
                jam_selesai TIME,
                ruangan VARCHAR(20),
                semester VARCHAR(10),
                tahun_ajaran VARCHAR(10)
            )
        `);
        console.log('Tabel jadwal_kuliah berhasil dibuat');
    } catch (err) {
        console.error('Error creating jadwal table:', err);
    } finally {
        pool.end();
    }
}

createJadwalTable();