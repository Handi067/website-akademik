// app.js

const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// =========================================================
// 1. KONFIGURASI DATABASE POSTGRESQL (Sandi Diperbarui)
// =========================================================
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'db_akademik', 
    password: '061202', // <-- Pastikan sandi ini benar
    port: 5432,
    ssl: false, // Solusi untuk error "The server does not support SSL connections"
});

// =========================================================
// 2. MIDDLEWARE & KONFIGURASI VIEW
// =========================================================
app.set('view engine', 'ejs');
app.set('views', 'views');

// Middleware untuk memproses data form (body-parser)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mengaktifkan akses ke file statis (CSS, JS, Gambar) di folder 'public'
const path = require('path'); // Wajib, tambahkan di bagian paling atas file jika belum ada
app.use(express.static(path.join(__dirname, 'public')));

// Middleware untuk mensimulasikan metode DELETE (dari form POST)
app.use((req, res, next) => {
    if (req.body && req.body._method === 'DELETE') {
        req.method = 'DELETE';
        delete req.body._method; 
    }
    next();
});

// Solusi untuk error "Cannot GET /mata-kuliah" lama: Redirect ke route baru
app.get('/mata-kuliah', (req, res) => {
    res.redirect('/mk-postgres');
});

// =========================================================
// 3. ROUTE UTAMA DAN MANAJEMEN MATA KULIAH (CRUD)
// =========================================================

// Halaman Utama (Homepage)
app.get('/', (req, res) => {
    res.render('index', {
        title: 'Selamat Datang di Portal Akademik Node.js',
        pengumuman: ['Akses /mk-postgres untuk manajemen data.'] 
    });
});

// READ: Menampilkan Daftar Mata Kuliah DARI DATABASE
app.get('/mk-postgres', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matakuliah ORDER BY kode_mk');
        res.render('mata-kuliah', {
            title: 'Daftar Mata Kuliah',
            listMk: result.rows 
        });
    } catch (err) {
        console.error('Error saat mengambil data mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data.');
    }
});

// CREATE (GET): Menampilkan Form Tambah MK
app.get('/tambah-mk', (req, res) => {
    res.render('tambah-mk');
});

// CREATE (POST): Memproses Simpan MK Baru
app.post('/tambah-mk', async (req, res) => {
    const { kode_mk, nama_mk, sks } = req.body;
    const sksInt = parseInt(sks);
    const query = 'INSERT INTO matakuliah (kode_mk, nama_mk, sks) VALUES ($1, $2, $3)';
    
    try {
        await pool.query(query, [kode_mk, nama_mk, sksInt]);
        res.redirect('/mk-postgres');
    } catch (err) {
        if (err.code === '23505') { 
             res.status(400).send('Gagal menyimpan: Kode Mata Kuliah sudah ada. <a href="/tambah-mk">Kembali</a>');
        } else {
             console.error('Error saat menyimpan mata kuliah baru:', err.stack);
             res.status(500).send('Terjadi kesalahan server saat menyimpan data.');
        }
    }
});

// UPDATE (GET): Menampilkan Form Edit MK
app.get('/edit-mk/:kode_mk', async (req, res) => {
    const { kode_mk } = req.params;
    const query = 'SELECT * FROM matakuliah WHERE kode_mk = $1';
    
    try {
        const result = await pool.query(query, [kode_mk]);
        if (result.rows.length === 0) {
            return res.status(404).send('Mata Kuliah tidak ditemukan.');
        }
        res.render('edit-mk', { mk: result.rows[0] });
    } catch (err) {
        console.error('Error saat mengambil data edit:', err.stack);
        res.status(500).send('Kesalahan server.');
    }
});

// UPDATE (POST): Memproses Perubahan MK
app.post('/edit-mk/:kode_mk', async (req, res) => {
    const kode_mk_awal = req.params.kode_mk;
    const { nama_mk, sks } = req.body;
    const sksInt = parseInt(sks);
    const query = 'UPDATE matakuliah SET nama_mk = $1, sks = $2 WHERE kode_mk = $3';
    
    try {
        await pool.query(query, [nama_mk, sksInt, kode_mk_awal]);
        res.redirect('/mk-postgres');
    } catch (err) {
        console.error('Error saat mengupdate mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat menyimpan perubahan.');
    }
});

// DELETE: Menghapus MK
app.delete('/hapus-mk/:kode_mk', async (req, res) => {
    const { kode_mk } = req.params;
    const query = 'DELETE FROM matakuliah WHERE kode_mk = $1';

    try {
        await pool.query(query, [kode_mk]);
        res.redirect('/mk-postgres');
    } catch (err) {
        console.error('Error saat menghapus mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat menghapus data.');
    }
});

// =========================================================
// 4. ROUTES: ABSENSI & REKAPITULASI
// =========================================================

// ABSEN (GET): Menampilkan Form Absensi
app.get('/absen/:kode_mk/:id_pertemuan', async (req, res) => {
    const { kode_mk, id_pertemuan } = req.params;

    try {
        // 1. Ambil data Pertemuan, Mata Kuliah, dan Mahasiswa
        const pertemuandata = await pool.query('SELECT * FROM pertemuan WHERE id_pertemuan = $1', [id_pertemuan]);
        const mkData = await pool.query('SELECT nama_mk FROM matakuliah WHERE kode_mk = $1', [kode_mk]);
        const mhsResult = await pool.query('SELECT nim, nama_mhs FROM mahasiswa ORDER BY nim');
        
        // 2. Ambil status absensi yang sudah ada
        const absenResult = await pool.query('SELECT nim, status_hadir FROM absen WHERE id_pertemuan = $1', [id_pertemuan]);
        
        // 3. Konversi hasil absensi menjadi objek lookup
        const existingAbsen = absenResult.rows.reduce((acc, current) => {
            acc[current.nim] = current.status_hadir;
            return acc;
        }, {});

        if (pertemuandata.rows.length === 0 || mkData.rows.length === 0) {
            return res.status(404).send('Pertemuan atau Mata Kuliah tidak ditemukan.');
        }

        res.render('form-absen', {
            pertemuan: pertemuandata.rows[0],
            nama_mk: mkData.rows[0].nama_mk,
            mahasiswa: mhsResult.rows,
            existingAbsen: existingAbsen
        });

    } catch (err) {
        console.error('Error saat menampilkan form absensi:', err.stack);
        res.status(500).send('Kesalahan Server saat mengambil data absensi.');
    }
});

// ABSEN (POST): Memproses Absensi
app.post('/absen/:kode_mk/:id_pertemuan', async (req, res) => {
    const { id_pertemuan } = req.params;
    const absensiData = req.body; 

    try {
        await pool.query('BEGIN'); 
        // Hapus absensi lama sebelum insert baru (agar update bekerja)
        await pool.query('DELETE FROM absen WHERE id_pertemuan = $1', [id_pertemuan]);

        const mhsNim = Object.keys(absensiData);
        for (const nim of mhsNim) {
            const status_hadir = absensiData[nim] === 'hadir'; 
            const query = 'INSERT INTO absen (id_pertemuan, nim, status_hadir) VALUES ($1, $2, $3)';
            await pool.query(query, [id_pertemuan, nim, status_hadir]);
        }

        await pool.query('COMMIT'); 
        res.redirect(`/mk-postgres`); 

    } catch (err) {
        await pool.query('ROLLBACK'); 
        console.error('Error saat menyimpan absensi:', err.stack);
        res.status(500).send('Gagal menyimpan data absensi.');
    }
});

// REKAP (GET): Menampilkan Rekapitulasi Absensi per Mata Kuliah
app.get('/rekap-absen/:kode_mk', async (req, res) => {
    const { kode_mk } = req.params;

    try {
        // 1. Hitung total pertemuan yang pernah diadakan untuk MK ini
        const totalPertemuanResult = await pool.query(
            'SELECT COUNT(id_pertemuan) AS total FROM pertemuan WHERE kode_mk = $1',
            [kode_mk]
        );
        const totalPertemuan = parseInt(totalPertemuanResult.rows[0].total) || 0;

        // 2. Query utama: Ambil data absensi dan hitung jumlah hadir
        const rekapQuery = `
            SELECT 
                m.nim, 
                m.nama_mhs, 
                COUNT(a.id_absen) FILTER (WHERE a.status_hadir = TRUE) AS total_hadir
            FROM mahasiswa m
            LEFT JOIN absen a ON m.nim = a.nim
            LEFT JOIN pertemuan p ON a.id_pertemuan = p.id_pertemuan AND p.kode_mk = $1
            GROUP BY m.nim, m.nama_mhs
            ORDER BY m.nim;
        `;
        const rekapResult = await pool.query(rekapQuery, [kode_mk]);
        
        // 3. Ambil data Mata Kuliah
        const mkData = await pool.query('SELECT nama_mk FROM matakuliah WHERE kode_mk = $1', [kode_mk]);
        
        if (mkData.rows.length === 0) {
            return res.status(404).send('Mata Kuliah tidak ditemukan untuk rekap.');
        }

        res.render('rekap-absen', {
            title: `Rekap Absensi ${mkData.rows[0].nama_mk}`,
            nama_mk: mkData.rows[0].nama_mk,
            kode_mk: kode_mk,
            totalPertemuan: totalPertemuan,
            rekapData: rekapResult.rows
        });

    } catch (err) {
        console.error('Error saat menampilkan rekap absensi:', err.stack);
        res.status(500).send('Kesalahan Server saat mengambil data rekapitulasi.');
    }
});
// =========================================================
// 3B. MANAJEMEN MAHASISWA (CRUD)
// =========================================================

// READ: Menampilkan Daftar Mahasiswa
app.get('/mahasiswa-crud', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM mahasiswa ORDER BY nim');
        res.render('mahasiswa', {
            title: 'Daftar Mahasiswa',
            listMhs: result.rows 
        });
    } catch (err) {
        console.error('Error saat mengambil data mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data mahasiswa.');
    }
});

// CREATE (GET): Menampilkan Form Tambah Mahasiswa
app.get('/tambah-mhs', (req, res) => {
    res.render('tambah-mhs');
});

// CREATE (POST): Memproses Simpan Mahasiswa Baru
app.post('/tambah-mhs', async (req, res) => {
    const { nim, nama_mhs, jurusan } = req.body;
    const query = 'INSERT INTO mahasiswa (nim, nama_mhs, jurusan) VALUES ($1, $2, $3)';
    
    try {
        await pool.query(query, [nim, nama_mhs, jurusan]);
        res.redirect('/mahasiswa-crud');
    } catch (err) {
        if (err.code === '23505') { 
             res.status(400).send('Gagal menyimpan: NIM sudah ada. <a href="/tambah-mhs">Kembali</a>');
        } else {
             console.error('Error saat menyimpan mahasiswa baru:', err.stack);
             res.status(500).send('Terjadi kesalahan server saat menyimpan data mahasiswa.');
        }
    }
});

// UPDATE (GET): Menampilkan Form Edit Mahasiswa
app.get('/edit-mhs/:nim', async (req, res) => {
    const { nim } = req.params;
    const query = 'SELECT * FROM mahasiswa WHERE nim = $1';
    
    try {
        const result = await pool.query(query, [nim]);
        if (result.rows.length === 0) {
            return res.status(404).send('Mahasiswa tidak ditemukan.');
        }
        res.render('edit-mhs', { mhs: result.rows[0] });
    } catch (err) {
        console.error('Error saat mengambil data edit mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data edit.');
    }
});

// UPDATE (POST): Memproses Perubahan Mahasiswa
app.post('/edit-mhs/:nim', async (req, res) => {
    const nim_awal = req.params.nim;
    const { nama_mhs, jurusan } = req.body;
    const query = 'UPDATE mahasiswa SET nama_mhs = $1, jurusan = $2 WHERE nim = $3';
    
    try {
        await pool.query(query, [nama_mhs, jurusan, nim_awal]);
        res.redirect('/mahasiswa-crud');
    } catch (err) {
        console.error('Error saat mengupdate mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat menyimpan perubahan mahasiswa.');
    }
});

// DELETE: Menghapus Mahasiswa
app.delete('/hapus-mhs/:nim', async (req, res) => {
    const { nim } = req.params;
    const query = 'DELETE FROM mahasiswa WHERE nim = $1';

    try {
        await pool.query(query, [nim]);
        res.redirect('/mahasiswa-crud');
    } catch (err) {
        // Peringatan: Hapus mahasiswa mungkin gagal jika NIM masih terkait di tabel absen!
        console.error('Error saat menghapus mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat menghapus data. Pastikan mahasiswa tidak terdaftar di tabel absen.');
    }
});

// app.js (Tambahkan di bawah REKAP (GET)...)

// =========================================================
// 4B. MANAJEMEN PERTEMUAN DINAMIS
// =========================================================

// READ: Menampilkan Daftar Pertemuan per Mata Kuliah
app.get('/kelola-pertemuan/:kode_mk', async (req, res) => {
    const { kode_mk } = req.params;

    try {
        // Ambil Nama Mata Kuliah
        const mkResult = await pool.query('SELECT nama_mk FROM matakuliah WHERE kode_mk = $1', [kode_mk]);
        if (mkResult.rows.length === 0) {
            return res.status(404).send('Mata Kuliah tidak ditemukan.');
        }

        // Ambil Daftar Pertemuan untuk MK ini
        const pertemuanResult = await pool.query(
            'SELECT * FROM pertemuan WHERE kode_mk = $1 ORDER BY id_pertemuan',
            [kode_mk]
        );

        res.render('kelola-pertemuan', {
            title: `Kelola Pertemuan: ${mkResult.rows[0].nama_mk}`,
            kode_mk: kode_mk,
            nama_mk: mkResult.rows[0].nama_mk,
            listPertemuan: pertemuanResult.rows
        });

    } catch (err) {
        console.error('Error saat mengambil daftar pertemuan:', err.stack);
        res.status(500).send('Kesalahan Server saat mengambil data pertemuan.');
    }
});

// CREATE (POST): Memproses Penambahan Pertemuan Baru
app.post('/tambah-pertemuan/:kode_mk', async (req, res) => {
    const { kode_mk } = req.params;
    // Input tanggal dan topik dari form
    const { tanggal, topik } = req.body; 

    // Query: id_pertemuan otomatis akan terisi oleh sequence PostgreSQL
    const query = 'INSERT INTO pertemuan (kode_mk, tanggal, topik) VALUES ($1, $2, $3)';
    
    try {
        await pool.query(query, [kode_mk, tanggal, topik]);
        res.redirect(`/kelola-pertemuan/${kode_mk}`);

    } catch (err) {
        console.error('Error saat menyimpan pertemuan baru:', err.stack);
        res.status(500).send('Gagal menyimpan data pertemuan baru.');
    }
});
// =========================================================
// 5. START SERVER
// =========================================================
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
    console.log(`Akses Manajemen MK di http://localhost:${port}/mk-postgres`);
    console.log(`Akses Rekap Absensi (Contoh): http://localhost:${port}/rekap-absen/SI205`);
});