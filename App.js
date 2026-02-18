// app.js

const express = require('express');
const { Pool } = require('pg');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const app = express();
const port = 3000;
const pkg = require('./package.json');

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

// Session middleware
app.use(session({
    secret: 'your-secret-key', // Ganti dengan secret yang aman
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set true jika menggunakan HTTPS
}));

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

// Middleware untuk autentikasi
function requireAuth(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }
}

// Middleware untuk admin
function requireAdmin(req, res, next) {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        res.status(403).send('Akses ditolak. Hanya admin yang bisa mengakses halaman ini.');
    }
}

// =========================================================
// 2B. ROUTES AUTENTIKASI
// =========================================================

// GET: Halaman Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// POST: Proses Login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            if (isValidPassword) {
                req.session.user = { id: user.id, username: user.username, role: user.role };
                res.redirect('/');
            } else {
                res.render('login', { error: 'Password salah' });
            }
        } else {
            res.render('login', { error: 'Username tidak ditemukan' });
        }
    } catch (err) {
        console.error('Error saat login:', err.stack);
        res.render('login', { error: 'Kesalahan server' });
    }
});

// GET: Halaman Register
app.get('/register', (req, res) => {
    res.render('register', { error: null });
});

// POST: Proses Register
app.post('/register', async (req, res) => {
    const { username, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.render('register', { error: 'Password tidak cocok' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, hashedPassword]);
        res.redirect('/login');
    } catch (err) {
        if (err.code === '23505') {
            res.render('register', { error: 'Username sudah ada' });
        } else {
            console.error('Error saat register:', err.stack);
            res.render('register', { error: 'Kesalahan server' });
        }
    }
});

// POST: Logout
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Solusi untuk error "Cannot GET /mata-kuliah" lama: Redirect ke route baru
app.get('/mata-kuliah', (req, res) => {
    res.redirect('/mk-postgres');
});

// =========================================================
// 3. ROUTE UTAMA DAN MANAJEMEN MATA KULIAH (CRUD)
// =========================================================

// Halaman Utama (Homepage)
app.get('/', requireAuth, (req, res) => {
    res.render('index', {
        title: 'Selamat Datang di Portal Akademik Node.js',
        pengumuman: ['Akses /mk-postgres untuk manajemen data.'],
        appInfo: {
            name: pkg.name,
            version: pkg.version,
            stack: 'Node.js, Express, EJS, PostgreSQL',
            port,
        },
        user: req.session.user,
        activeTab: 'dashboard'
    });
});

// READ: Menampilkan Daftar Mata Kuliah untuk User (Read Only)
app.get('/mata-kuliah-view', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matakuliah ORDER BY kode_mk');
        res.render('mata-kuliah-view', {
            title: 'Daftar Mata Kuliah',
            listMk: result.rows,
            user: req.session.user,
            activeTab: 'absensi'
        });
    } catch (err) {
        console.error('Error saat mengambil data mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data.');
    }
});

// READ: Menampilkan Daftar Mata Kuliah DARI DATABASE
app.get('/mk-postgres', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM matakuliah ORDER BY kode_mk');
        res.render('mata-kuliah', {
            title: 'Daftar Mata Kuliah',
            listMk: result.rows,
            activeTab: 'mata-kuliah'
        });
    } catch (err) {
        console.error('Error saat mengambil data mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data.');
    }
});

// CREATE (GET): Menampilkan Form Tambah MK
app.get('/tambah-mk', requireAuth, requireAdmin, (req, res) => {
    res.render('tambah-mk');
});

// CREATE (POST): Memproses Simpan MK Baru
app.post('/tambah-mk', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/edit-mk/:kode_mk', requireAuth, requireAdmin, async (req, res) => {
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
app.post('/edit-mk/:kode_mk', requireAuth, requireAdmin, async (req, res) => {
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
app.delete('/hapus-mk/:kode_mk', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/mahasiswa-crud', requireAuth, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM mahasiswa ORDER BY nim');
        res.render('mahasiswa', {
            title: 'Daftar Mahasiswa',
            listMhs: result.rows,
            activeTab: 'mahasiswa'
        });
    } catch (err) {
        console.error('Error saat mengambil data mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data mahasiswa.');
    }
});

// CREATE (GET): Menampilkan Form Tambah Mahasiswa
app.get('/tambah-mhs', requireAuth, requireAdmin, (req, res) => {
    res.render('tambah-mhs');
});

// CREATE (POST): Memproses Simpan Mahasiswa Baru
app.post('/tambah-mhs', requireAuth, requireAdmin, async (req, res) => {
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
app.get('/edit-mhs/:nim', requireAuth, requireAdmin, async (req, res) => {
    const { nim } = req.params;
    const query = 'SELECT * FROM mahasiswa WHERE nim = $1';
    
    try {
        const result = await pool.query(query, [nim]);
        if (result.rows.length === 0) {
            return res.status(404).send('Mahasiswa tidak ditemukan.');
        }
        res.render('edit-mhs', { mhs: result.rows[0], activeTab: 'mahasiswa' });
    } catch (err) {
        console.error('Error saat mengambil data edit mahasiswa:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data edit.');
    }
});

// UPDATE (POST): Memproses Perubahan Mahasiswa
app.post('/edit-mhs/:nim', requireAuth, requireAdmin, async (req, res) => {
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
app.delete('/hapus-mhs/:nim', requireAuth, requireAdmin, async (req, res) => {
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
// 6. FITUR TAMBAHAN
// =========================================================

// TRANSCRIPT NILAI
app.get('/transkrip', requireAuth, async (req, res) => {
    try {
        // Untuk user biasa, tampilkan transkrip mereka sendiri
        // Untuk admin, bisa lihat semua atau pilih mahasiswa
        const nim = req.session.user.role === 'admin' ? req.query.nim : req.session.user.nim;

        if (!nim && req.session.user.role !== 'admin') {
            return res.render('transkrip', {
                title: 'Transkrip Nilai',
                activeTab: 'transkrip',
                user: req.session.user,
                transkripData: [],
                mahasiswa: [],
                selectedNim: null
            });
        }

        let query, params;
        if (req.session.user.role === 'admin') {
            // Admin bisa lihat semua mahasiswa
            const mhsResult = await pool.query('SELECT nim, nama_mhs FROM mahasiswa ORDER BY nim');
            query = `
                SELECT n.*, m.nama_mhs, mk.nama_mk, mk.sks
                FROM nilai n
                JOIN mahasiswa m ON n.nim = m.nim
                JOIN matakuliah mk ON n.kode_mk = mk.kode_mk
                ${nim ? 'WHERE n.nim = $1' : ''}
                ORDER BY n.tahun_ajaran DESC, n.semester DESC, n.kode_mk
            `;
            params = nim ? [nim] : [];
            res.render('transkrip', {
                title: 'Transkrip Nilai',
                activeTab: 'transkrip',
                user: req.session.user,
                transkripData: (await pool.query(query, params)).rows,
                mahasiswa: mhsResult.rows,
                selectedNim: nim
            });
        } else {
            // User biasa lihat transkrip sendiri
            query = `
                SELECT n.*, m.nama_mhs, mk.nama_mk, mk.sks
                FROM nilai n
                JOIN mahasiswa m ON n.nim = m.nim
                JOIN matakuliah mk ON n.kode_mk = mk.kode_mk
                WHERE n.nim = $1
                ORDER BY n.tahun_ajaran DESC, n.semester DESC, n.kode_mk
            `;
            const result = await pool.query(query, [nim]);
            res.render('transkrip', {
                title: 'Transkrip Nilai',
                activeTab: 'transkrip',
                user: req.session.user,
                transkripData: result.rows,
                mahasiswa: [],
                selectedNim: nim
            });
        }
    } catch (err) {
        console.error('Error saat mengambil transkrip:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data transkrip.');
    }
});

// KELOLA NILAI
app.get('/kelola-nilai', requireAuth, async (req, res) => {
    try {
        const nilaiResult = await pool.query(`
            SELECT n.*, m.nama_mhs, mk.nama_mk
            FROM nilai n
            JOIN mahasiswa m ON n.nim = m.nim
            JOIN matakuliah mk ON n.kode_mk = mk.kode_mk
            ORDER BY n.tahun_ajaran DESC, n.semester DESC, n.kode_mk, m.nama_mhs
        `);
        res.render('kelola-nilai', {
            title: 'Kelola Nilai',
            activeTab: 'nilai',
            user: req.session.user,
            nilaiData: nilaiResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data nilai:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data nilai.');
    }
});

app.get('/tambah-nilai', requireAuth, requireAdmin, async (req, res) => {
    try {
        const mahasiswaResult = await pool.query('SELECT * FROM mahasiswa ORDER BY nama_mhs');
        const matakuliahResult = await pool.query('SELECT * FROM matakuliah ORDER BY nama_mk');
        res.render('tambah-nilai', {
            title: 'Tambah Nilai',
            activeTab: 'nilai',
            user: req.session.user,
            mahasiswa: mahasiswaResult.rows,
            matakuliah: matakuliahResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data untuk form nilai:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data.');
    }
});

app.post('/tambah-nilai', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { nim, kode_mk, tugas, uts, uas, semester, tahun_ajaran } = req.body;

        // Hitung nilai akhir (contoh: 20% tugas + 30% UTS + 50% UAS)
        const nilai_akhir = (parseFloat(tugas) * 0.2) + (parseFloat(uts) * 0.3) + (parseFloat(uas) * 0.5);

        await pool.query(`
            INSERT INTO nilai (nim, kode_mk, tugas, uts, uas, nilai, semester, tahun_ajaran)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [nim, kode_mk, tugas, uts, uas, nilai_akhir, semester, tahun_ajaran]);

        res.redirect('/kelola-nilai');
    } catch (err) {
        console.error('Error saat menambah nilai:', err.stack);
        res.status(500).send('Kesalahan server saat menambah nilai.');
    }
});

app.get('/edit-nilai/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const nilaiResult = await pool.query(`
            SELECT n.*, m.nama_mhs, mk.nama_mk
            FROM nilai n
            JOIN mahasiswa m ON n.nim = m.nim
            JOIN matakuliah mk ON n.kode_mk = mk.kode_mk
            WHERE n.id = $1
        `, [id]);

        if (nilaiResult.rows.length === 0) {
            return res.status(404).send('Data nilai tidak ditemukan.');
        }

        res.render('edit-nilai', {
            title: 'Edit Nilai',
            activeTab: 'nilai',
            user: req.session.user,
            nilai: nilaiResult.rows[0]
        });
    } catch (err) {
        console.error('Error saat mengambil data nilai untuk edit:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data nilai.');
    }
});

app.post('/edit-nilai/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { tugas, uts, uas, semester, tahun_ajaran } = req.body;

        // Hitung nilai akhir (contoh: 20% tugas + 30% UTS + 50% UAS)
        const nilai_akhir = (parseFloat(tugas) * 0.2) + (parseFloat(uts) * 0.3) + (parseFloat(uas) * 0.5);

        await pool.query(`
            UPDATE nilai
            SET tugas = $1, uts = $2, uas = $3, nilai = $4, semester = $5, tahun_ajaran = $6
            WHERE id = $7
        `, [tugas, uts, uas, nilai_akhir, semester, tahun_ajaran, id]);

        res.redirect('/kelola-nilai');
    } catch (err) {
        console.error('Error saat mengupdate nilai:', err.stack);
        res.status(500).send('Kesalahan server saat mengupdate nilai.');
    }
});

app.post('/hapus-nilai/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM nilai WHERE id = $1', [id]);
        res.redirect('/kelola-nilai');
    } catch (err) {
        console.error('Error saat menghapus nilai:', err.stack);
        res.status(500).send('Kesalahan server saat menghapus nilai.');
    }
});

// PERPUSTAKAAN
app.get('/perpustakaan', requireAuth, async (req, res) => {
    try {
        const bukuResult = await pool.query('SELECT * FROM buku ORDER BY judul');
        const peminjamanResult = await pool.query(`
            SELECT p.*, b.judul, m.nama_mhs
            FROM peminjaman p
            JOIN buku b ON p.kode_buku = b.kode_buku
            JOIN mahasiswa m ON p.nim = m.nim
            WHERE p.nim = $1 AND p.status = 'dipinjam'
            ORDER BY p.tanggal_pinjam DESC
        `, [req.session.user.nim || '']);

        res.render('perpustakaan', {
            title: 'Perpustakaan',
            activeTab: 'perpustakaan',
            user: req.session.user,
            daftarBuku: bukuResult.rows,
            peminjamanAktif: peminjamanResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data perpustakaan:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data perpustakaan.');
    }
});

// JADWAL KULIAH
app.get('/jadwal', requireAuth, async (req, res) => {
    try {
        const jadwalResult = await pool.query(`
            SELECT j.*, m.nama_mk, m.sks
            FROM jadwal_kuliah j
            JOIN matakuliah m ON j.kode_mk = m.kode_mk
            ORDER BY
                CASE j.hari
                    WHEN 'Senin' THEN 1
                    WHEN 'Selasa' THEN 2
                    WHEN 'Rabu' THEN 3
                    WHEN 'Kamis' THEN 4
                    WHEN 'Jumat' THEN 5
                    WHEN 'Sabtu' THEN 6
                    WHEN 'Minggu' THEN 7
                END,
                j.jam_mulai
        `);

        res.render('jadwal', {
            title: 'Jadwal Kuliah',
            activeTab: 'jadwal',
            user: req.session.user,
            jadwalData: jadwalResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil jadwal:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data jadwal.');
    }
});

// KRS (Kartu Rencana Studi)
// =========================================================

// View available courses for KRS (students only)
app.get('/krs', requireAuth, async (req, res) => {
    try {
        const { semester, tahun_ajaran } = req.query;
        const currentSemester = semester || 'Ganjil';
        const currentTahun = tahun_ajaran || '2024/2025';

        // Get available jadwal for current semester
        const jadwalResult = await pool.query(`
            SELECT j.*, m.nama_mk, m.sks
            FROM jadwal_kuliah j
            JOIN matakuliah m ON j.kode_mk = m.kode_mk
            WHERE j.semester = $1 AND j.tahun_ajaran = $2
            ORDER BY
                CASE j.hari
                    WHEN 'Senin' THEN 1
                    WHEN 'Selasa' THEN 2
                    WHEN 'Rabu' THEN 3
                    WHEN 'Kamis' THEN 4
                    WHEN 'Jumat' THEN 5
                    WHEN 'Sabtu' THEN 6
                    WHEN 'Minggu' THEN 7
                END,
                j.jam_mulai
        `, [currentSemester, currentTahun]);

        // Get student's current KRS
        const krsResult = await pool.query(`
            SELECT k.*, j.kode_mk, j.hari, j.jam_mulai, j.jam_selesai, j.ruangan, j.dosen, j.kelas,
                   m.nama_mk, m.sks
            FROM krs k
            JOIN jadwal_kuliah j ON k.jadwal_id = j.id
            JOIN matakuliah m ON j.kode_mk = m.kode_mk
            WHERE k.nim = $1 AND k.semester = $2 AND k.tahun_ajaran = $3 AND k.status = 'aktif'
        `, [req.session.user.nim, currentSemester, currentTahun]);

        res.render('krs', {
            title: 'Kartu Rencana Studi',
            activeTab: 'krs',
            user: req.session.user,
            jadwalData: jadwalResult.rows,
            krsData: krsResult.rows,
            currentSemester,
            currentTahun
        });
    } catch (err) {
        console.error('Error saat mengambil data KRS:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data KRS.');
    }
});

// Add course to KRS
app.post('/krs/add', requireAuth, async (req, res) => {
    try {
        const { jadwal_id, semester, tahun_ajaran } = req.body;
        const nim = req.session.user.nim;

        // Check if course is already in KRS
        const existing = await pool.query(`
            SELECT id FROM krs
            WHERE nim = $1 AND jadwal_id = $2 AND semester = $3 AND tahun_ajaran = $4
        `, [nim, jadwal_id, semester, tahun_ajaran]);

        if (existing.rows.length > 0) {
            return res.status(400).json({ error: 'Mata kuliah sudah ada di KRS Anda' });
        }

        // Check for schedule conflicts
        const jadwalInfo = await pool.query(`
            SELECT hari, jam_mulai, jam_selesai FROM jadwal_kuliah WHERE id = $1
        `, [jadwal_id]);

        if (jadwalInfo.rows.length === 0) {
            return res.status(404).json({ error: 'Jadwal tidak ditemukan' });
        }

        const newJadwal = jadwalInfo.rows[0];

        // Check conflicts with existing KRS
        const conflicts = await pool.query(`
            SELECT j.kode_mk, m.nama_mk
            FROM krs k
            JOIN jadwal_kuliah j ON k.jadwal_id = j.id
            JOIN matakuliah m ON j.kode_mk = m.kode_mk
            WHERE k.nim = $1 AND k.semester = $2 AND k.tahun_ajaran = $3 AND k.status = 'aktif'
            AND j.hari = $4
            AND (
                (j.jam_mulai <= $5 AND j.jam_selesai > $5) OR
                (j.jam_mulai < $6 AND j.jam_selesai >= $6) OR
                (j.jam_mulai >= $5 AND j.jam_selesai <= $6)
            )
        `, [nim, semester, tahun_ajaran, newJadwal.hari, newJadwal.jam_mulai, newJadwal.jam_selesai]);

        if (conflicts.rows.length > 0) {
            return res.status(400).json({
                error: `Konflik jadwal dengan ${conflicts.rows[0].nama_mk} (${conflicts.rows[0].kode_mk})`
            });
        }

        // Add to KRS
        await pool.query(`
            INSERT INTO krs (nim, jadwal_id, semester, tahun_ajaran)
            VALUES ($1, $2, $3, $4)
        `, [nim, jadwal_id, semester, tahun_ajaran]);

        res.json({ success: true, message: 'Mata kuliah berhasil ditambahkan ke KRS' });
    } catch (err) {
        console.error('Error saat menambah mata kuliah ke KRS:', err.stack);
        res.status(500).json({ error: 'Kesalahan server saat menambah mata kuliah ke KRS' });
    }
});

// Remove course from KRS
app.post('/krs/remove', requireAuth, async (req, res) => {
    try {
        const { jadwal_id, semester, tahun_ajaran } = req.body;
        const nim = req.session.user.nim;

        await pool.query(`
            DELETE FROM krs
            WHERE nim = $1 AND jadwal_id = $2 AND semester = $3 AND tahun_ajaran = $4
        `, [nim, jadwal_id, semester, tahun_ajaran]);

        res.json({ success: true, message: 'Mata kuliah berhasil dihapus dari KRS' });
    } catch (err) {
        console.error('Error saat menghapus mata kuliah dari KRS:', err.stack);
        res.status(500).json({ error: 'Kesalahan server saat menghapus mata kuliah dari KRS' });
    }
});

// TUGAS (ASSIGNMENTS)
// =========================================================

// View all assignments (students see available, admin sees all)
app.get('/tugas', requireAuth, async (req, res) => {
    try {
        let query, params = [];

        if (req.session.user.role === 'admin') {
            // Admin sees all assignments
            query = `
                SELECT t.*, mk.nama_mk,
                       COUNT(jt.id) as jumlah_pengumpulan
                FROM tugas t
                JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
                LEFT JOIN jawaban_tugas jt ON t.id = jt.tugas_id
                GROUP BY t.id, mk.nama_mk
                ORDER BY t.deadline ASC, t.created_at DESC
            `;
        } else {
            // Students see assignments for their enrolled courses
            query = `
                SELECT t.*, mk.nama_mk,
                       CASE WHEN jt.id IS NOT NULL THEN 'sudah_mengumpul'
                            ELSE 'belum_mengumpul' END as status_pengumpulan,
                       jt.nilai, jt.status
                FROM tugas t
                JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
                LEFT JOIN jawaban_tugas jt ON t.id = jt.tugas_id AND jt.nim = $1
                ORDER BY t.deadline ASC, t.created_at DESC
            `;
            params = [req.session.user.nim];
        }

        const tugasResult = await pool.query(query, params);
        res.render('tugas', {
            title: 'Tugas',
            activeTab: 'tugas',
            user: req.session.user,
            tugasData: tugasResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data tugas:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data tugas.');
    }
});

// View assignment details and submissions (admin only)
app.get('/kelola-tugas', requireAuth, requireAdmin, async (req, res) => {
    try {
        const tugasResult = await pool.query(`
            SELECT t.*, mk.nama_mk
            FROM tugas t
            JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
            ORDER BY t.deadline ASC, t.created_at DESC
        `);
        res.render('kelola-tugas', {
            title: 'Kelola Tugas',
            activeTab: 'tugas',
            user: req.session.user,
            tugasData: tugasResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data tugas:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data tugas.');
    }
});

// Add new assignment (admin only)
app.get('/tambah-tugas', requireAuth, requireAdmin, async (req, res) => {
    try {
        const matakuliahResult = await pool.query('SELECT * FROM matakuliah ORDER BY nama_mk');
        res.render('tambah-tugas', {
            title: 'Tambah Tugas',
            activeTab: 'tugas',
            user: req.session.user,
            matakuliah: matakuliahResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data mata kuliah:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data.');
    }
});

app.post('/tambah-tugas', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { kode_mk, judul, deskripsi, deadline, tipe_soal, soal_pilgan } = req.body;

        let soalPilganJson = null;
        if (tipe_soal === 'pilgan' && soal_pilgan) {
            // Parse the multiple choice questions from form data
            const questions = [];
            const questionKeys = Object.keys(req.body).filter(key => key.startsWith('question_'));

            for (let i = 0; i < questionKeys.length; i++) {
                const qKey = `question_${i}`;
                const optAKey = `option_a_${i}`;
                const optBKey = `option_b_${i}`;
                const optCKey = `option_c_${i}`;
                const optDKey = `option_d_${i}`;
                const correctKey = `correct_${i}`;

                if (req.body[qKey]) {
                    questions.push({
                        question: req.body[qKey],
                        options: {
                            a: req.body[optAKey] || '',
                            b: req.body[optBKey] || '',
                            c: req.body[optCKey] || '',
                            d: req.body[optDKey] || ''
                        },
                        correct: req.body[correctKey] || ''
                    });
                }
            }
            soalPilganJson = JSON.stringify(questions);
        }

        await pool.query(`
            INSERT INTO tugas (kode_mk, judul, deskripsi, deadline, tipe_soal, soal_pilgan)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [kode_mk, judul, deskripsi, deadline, tipe_soal || 'essay', soalPilganJson]);
        res.redirect('/kelola-tugas');
    } catch (err) {
        console.error('Error saat menambah tugas:', err.stack);
        res.status(500).send('Kesalahan server saat menambah tugas.');
    }
});

// Edit assignment (admin only)
app.get('/edit-tugas/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const tugasResult = await pool.query(`
            SELECT t.*, mk.nama_mk
            FROM tugas t
            JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
            WHERE t.id = $1
        `, [id]);

        if (tugasResult.rows.length === 0) {
            return res.status(404).send('Tugas tidak ditemukan.');
        }

        const matakuliahResult = await pool.query('SELECT * FROM matakuliah ORDER BY nama_mk');

        res.render('edit-tugas', {
            title: 'Edit Tugas',
            activeTab: 'tugas',
            user: req.session.user,
            tugas: tugasResult.rows[0],
            matakuliah: matakuliahResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil data tugas untuk edit:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil data tugas.');
    }
});

app.post('/edit-tugas/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { kode_mk, judul, deskripsi, deadline, tipe_soal, soal_pilgan } = req.body;

        let soalPilganJson = null;
        if (tipe_soal === 'pilgan' && soal_pilgan) {
            // Parse the multiple choice questions from form data
            const questions = [];
            const questionKeys = Object.keys(req.body).filter(key => key.startsWith('question_'));

            for (let i = 0; i < questionKeys.length; i++) {
                const qKey = `question_${i}`;
                const optAKey = `option_a_${i}`;
                const optBKey = `option_b_${i}`;
                const optCKey = `option_c_${i}`;
                const optDKey = `option_d_${i}`;
                const correctKey = `correct_${i}`;

                if (req.body[qKey]) {
                    questions.push({
                        question: req.body[qKey],
                        options: {
                            a: req.body[optAKey] || '',
                            b: req.body[optBKey] || '',
                            c: req.body[optCKey] || '',
                            d: req.body[optDKey] || ''
                        },
                        correct: req.body[correctKey] || ''
                    });
                }
            }
            soalPilganJson = JSON.stringify(questions);
        }

        await pool.query(`
            UPDATE tugas
            SET kode_mk = $1, judul = $2, deskripsi = $3, deadline = $4, tipe_soal = $5, soal_pilgan = $6, updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
        `, [kode_mk, judul, deskripsi, deadline, tipe_soal || 'essay', soalPilganJson, id]);
        res.redirect('/kelola-tugas');
    } catch (err) {
        console.error('Error saat mengupdate tugas:', err.stack);
        res.status(500).send('Kesalahan server saat mengupdate tugas.');
    }
});

// Delete assignment (admin only)
app.post('/hapus-tugas/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM tugas WHERE id = $1', [id]);
        res.redirect('/kelola-tugas');
    } catch (err) {
        console.error('Error saat menghapus tugas:', err.stack);
        res.status(500).send('Kesalahan server saat menghapus tugas.');
    }
});

// View assignment details and submit answer (students)
app.get('/tugas/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const tugasResult = await pool.query(`
            SELECT t.*, mk.nama_mk
            FROM tugas t
            JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
            WHERE t.id = $1
        `, [id]);

        if (tugasResult.rows.length === 0) {
            return res.status(404).send('Tugas tidak ditemukan.');
        }

        const tugas = tugasResult.rows[0];

        // Get student's submission if exists
        const jawabanResult = await pool.query(`
            SELECT * FROM jawaban_tugas
            WHERE tugas_id = $1 AND nim = $2
        `, [id, req.session.user.nim]);

        res.render('detail-tugas', {
            title: `Tugas: ${tugas.judul}`,
            activeTab: 'tugas',
            user: req.session.user,
            tugas: tugas,
            jawaban: jawabanResult.rows[0] || null
        });
    } catch (err) {
        console.error('Error saat mengambil detail tugas:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil detail tugas.');
    }
});

// Submit assignment answer (students)
app.post('/submit-tugas/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { jawaban, tipe_soal } = req.body;
        const nim = req.session.user.nim;

        let jawabanPilganJson = null;
        if (tipe_soal === 'pilgan') {
            // Collect multiple choice answers
            const answers = {};
            Object.keys(req.body).forEach(key => {
                if (key.startsWith('answer_')) {
                    const questionIndex = key.replace('answer_', '');
                    answers[questionIndex] = req.body[key];
                }
            });
            jawabanPilganJson = JSON.stringify(answers);
        }

        // Check if already submitted
        const existing = await pool.query(`
            SELECT id FROM jawaban_tugas WHERE tugas_id = $1 AND nim = $2
        `, [id, nim]);

        if (existing.rows.length > 0) {
            // Update existing submission
            await pool.query(`
                UPDATE jawaban_tugas
                SET jawaban = $1, jawaban_pilgan = $2, submitted_at = CURRENT_TIMESTAMP, status = 'belum_dinilai'
                WHERE tugas_id = $3 AND nim = $4
            `, [jawaban, jawabanPilganJson, id, nim]);
        } else {
            // Insert new submission
            await pool.query(`
                INSERT INTO jawaban_tugas (tugas_id, nim, jawaban, jawaban_pilgan, status)
                VALUES ($1, $2, $3, $4, 'belum_dinilai')
            `, [id, nim, jawaban, jawabanPilganJson]);
        }

        res.redirect(`/tugas/${id}`);
    } catch (err) {
        console.error('Error saat submit tugas:', err.stack);
        res.status(500).send('Kesalahan server saat submit tugas.');
    }
});

// View submissions for a specific assignment (admin only)
app.get('/tugas/:id/submissions', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const tugasResult = await pool.query(`
            SELECT t.*, mk.nama_mk
            FROM tugas t
            JOIN matakuliah mk ON t.kode_mk = mk.kode_mk
            WHERE t.id = $1
        `, [id]);

        if (tugasResult.rows.length === 0) {
            return res.status(404).send('Tugas tidak ditemukan.');
        }

        const submissionsResult = await pool.query(`
            SELECT jt.*, m.nama_mhs
            FROM jawaban_tugas jt
            JOIN mahasiswa m ON jt.nim = m.nim
            WHERE jt.tugas_id = $1
            ORDER BY jt.submitted_at DESC
        `, [id]);

        res.render('submissions-tugas', {
            title: `Submissions: ${tugasResult.rows[0].judul}`,
            activeTab: 'tugas',
            user: req.session.user,
            tugas: tugasResult.rows[0],
            submissions: submissionsResult.rows
        });
    } catch (err) {
        console.error('Error saat mengambil submissions:', err.stack);
        res.status(500).send('Kesalahan server saat mengambil submissions.');
    }
});

// Grade student submission (admin only)
app.post('/grade-submission/:id', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        let { nilai } = req.body;

        // Get submission details and assignment info
        const submissionResult = await pool.query(`
            SELECT jt.*, t.tipe_soal, t.soal_pilgan
            FROM jawaban_tugas jt
            JOIN tugas t ON jt.tugas_id = t.id
            WHERE jt.id = $1
        `, [id]);

        if (submissionResult.rows.length > 0) {
            const submission = submissionResult.rows[0];

            // Auto-grade multiple choice questions
            if (submission.tipe_soal === 'pilgan' && submission.soal_pilgan && submission.jawaban_pilgan) {
                const questions = submission.soal_pilgan;
                const answers = submission.jawaban_pilgan;

                let correctAnswers = 0;
                let totalQuestions = questions.length;

                questions.forEach((q, index) => {
                    if (answers[index] === q.correct) {
                        correctAnswers++;
                    }
                });

                // Calculate score (percentage)
                nilai = Math.round((correctAnswers / totalQuestions) * 100);
            }
        }

        await pool.query(`
            UPDATE jawaban_tugas
            SET nilai = $1, status = 'sudah_dinilai'
            WHERE id = $2
        `, [nilai, id]);

        // Redirect back to submissions page
        const submission = await pool.query('SELECT tugas_id FROM jawaban_tugas WHERE id = $1', [id]);
        res.redirect(`/tugas/${submission.rows[0].tugas_id}/submissions`);
    } catch (err) {
        console.error('Error saat memberikan nilai:', err.stack);
        res.status(500).send('Kesalahan server saat memberikan nilai.');
    }
});

// =========================================================
app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
    console.log(`Akses Manajemen MK di http://localhost:${port}/mk-postgres`);
    console.log(`Akses Rekap Absensi (Contoh): http://localhost:${port}/rekap-absen/SI205`);
});