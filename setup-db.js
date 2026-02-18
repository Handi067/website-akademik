const { Pool } = require('pg');

// Konfigurasi database
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

// Script untuk membuat tabel users
async function setupDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'user'
            );
        `);
        console.log('Tabel users berhasil dibuat atau sudah ada.');
    } catch (err) {
        console.error('Error creating table:', err);
    } finally {
        pool.end();
    }
}

setupDatabase();