const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// Konfigurasi database
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

// Script untuk membuat user admin
async function createAdminUser() {
    try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hashedPassword, 'admin']);
        console.log('User admin berhasil dibuat. Username: admin, Password: admin123');
    } catch (err) {
        console.error('Error creating admin user:', err);
    } finally {
        pool.end();
    }
}

createAdminUser();