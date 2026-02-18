const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik',
    password: '061202',
    port: 5432,
    ssl: false,
});

async function updateAdminRole() {
    try {
        await pool.query("UPDATE users SET role = 'admin' WHERE username = 'admin'");
        console.log('Admin role updated successfully');
    } catch (err) {
        console.error('Error updating admin role:', err);
    } finally {
        pool.end();
    }
}

updateAdminRole();