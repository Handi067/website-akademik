const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function alterTugasTables() {
    try {
        // Add question type to tugas table
        await pool.query(`
            ALTER TABLE tugas
            ADD COLUMN IF NOT EXISTS tipe_soal VARCHAR(20) DEFAULT 'essay',
            ADD COLUMN IF NOT EXISTS soal_pilgan JSONB DEFAULT NULL
        `);
        console.log('Kolom tipe_soal dan soal_pilgan berhasil ditambahkan ke tabel tugas');

        // Modify jawaban_tugas to support multiple choice answers
        await pool.query(`
            ALTER TABLE jawaban_tugas
            ADD COLUMN IF NOT EXISTS jawaban_pilgan JSONB DEFAULT NULL
        `);
        console.log('Kolom jawaban_pilgan berhasil ditambahkan ke tabel jawaban_tugas');

    } catch (err) {
        console.error('Error altering tugas tables:', err);
    } finally {
        pool.end();
    }
}

alterTugasTables();