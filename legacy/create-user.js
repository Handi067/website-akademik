const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function createUser() {
    try {
        const hashedPassword = await bcrypt.hash('user123', 10);
        await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['user', hashedPassword, 'user']);
        console.log('User account created: username=user, password=user123');
    } catch (err) {
        console.error('Error creating user:', err);
    } finally {
        pool.end();
    }
}

createUser();