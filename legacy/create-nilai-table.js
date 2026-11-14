const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function createNilaiTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS nilai (
                id SERIAL PRIMARY KEY,
                nim VARCHAR(20) REFERENCES mahasiswa(nim),
                kode_mk VARCHAR(10) REFERENCES matakuliah(kode_mk),
                nilai DECIMAL(5,2),
                semester VARCHAR(10),
                tahun_ajaran VARCHAR(10)
            )
        `);
        console.log('Tabel nilai berhasil dibuat');
    } catch (err) {
        console.error('Error creating nilai table:', err);
    } finally {
        pool.end();
    }
}

createNilaiTable();