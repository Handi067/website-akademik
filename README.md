# Academic Information System

A comprehensive, modern, and scalable academic information system built with Node.js, Express, React, TypeScript, and PostgreSQL.

## 🚀 Features

### Core Academic Functions
- **User Management**: Multi-role system (Admin, Dosen, Mahasiswa) with RBAC
- **Student Management**: Complete student data management
- **Lecturer Management**: Faculty and staff management
- **Course Management**: Course catalog with prerequisites
- **Schedule Management**: Class scheduling and timetabling
- **KRS (Course Registration)**: Online course registration with prerequisite validation
- **KHS (Academic Transcript)**: Grade management and academic records
- **Attendance System**: Digital attendance tracking
- **Library System**: Book management and borrowing system

### Advanced Features
- **Dashboard Analytics**: Real-time academic performance analytics
- **Export Functionality**: PDF/Excel report generation
- **Notification System**: Real-time notifications for important events
- **Audit Logging**: Complete activity tracking for security
- **API Documentation**: Comprehensive REST API with Swagger
- **Responsive Design**: Mobile-friendly interface

## 🛠 Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Validation**: Joi / Zod
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **UI Components**: Tailwind CSS + Headless UI
- **Forms**: React Hook Form + Zod
- **Charts**: Chart.js / Recharts
- **HTTP Client**: Axios
- **Build Tool**: Vite

### DevOps & Deployment
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Database**: PostgreSQL with Redis caching
- **Reverse Proxy**: Nginx
- **Process Manager**: PM2

## 📁 Project Structure

```
website-akademik/
├── backend/                    # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── controllers/        # Request handlers
│   │   ├── middleware/         # Custom middleware
│   │   ├── models/            # Data models
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic
│   │   ├── utils/             # Utility functions
│   │   ├── types/             # TypeScript definitions
│   │   └── config/            # Configuration files
│   ├── prisma/                # Prisma ORM
│   └── tests/                 # Test files
├── frontend/                  # React + TypeScript
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/          # API services
│   │   ├── store/            # State management
│   │   ├── types/            # TypeScript types
│   │   └── utils/            # Utility functions
│   └── public/               # Static assets
├── docker-compose.yml         # Docker configuration
├── docs/                      # Dokumentasi arsitektur & desain
├── postman/                   # Koleksi Postman & spesifikasi OpenAPI
└── legacy/                    # Aplikasi lama Express + EJS (arsip)
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd website-akademik
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Edit .env with your database credentials
   npm run prisma:migrate
   npm run prisma:seed
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Using Docker (Recommended)**
   ```bash
   docker-compose up -d
   ```

### Catatan pengembangan lokal

- Backend memakai database **`db_akademik_v2`**, terpisah dari `db_akademik` milik aplikasi lama (Express + EJS, kini di `legacy/`).
  Seed menolak berjalan bila mendeteksi tabel aplikasi lama.
- Backend berjalan di port **3001**; frontend (Vite, port 3000) mem-proxy `/api` ke sana.
- Periode akademik aktif diatur lewat `SEMESTER_AKTIF` dan `TAHUN_AJARAN_AKTIF` di `backend/.env`.
- Reset data ke kondisi awal: `cd backend && npx prisma migrate reset` (menjalankan seed otomatis).
- Unit & contract test (tanpa database): `cd backend && npm test` (`npm run test:coverage` untuk cakupan).
  Mencakup perhitungan nilai/IP, aturan KRS, aturan perpustakaan, serta sinkronisasi spec OpenAPI dengan route.
- Uji API end-to-end: `cd backend && npm run test:api`, atau `postman collection run "postman/collections/Website Akademik API.postman_collection.json"`
  (jalankan setelah reset data, karena koleksi mengubah data).

### Default Login Credentials
- **Admin**: `admin` / `admin123`
- **Dosen 1**: `dosen1` / `dosen123`
- **Dosen 2**: `dosen2` / `dosen123`
- **Mahasiswa 1**: `mahasiswa1` / `mahasiswa123`
- **Mahasiswa 2**: `mahasiswa2` / `mahasiswa123`

## 📊 Database Schema

The system uses a comprehensive database schema with the following main entities:

- **Users**: Authentication and authorization
- **Mahasiswa**: Student data and academic records
- **Dosen**: Faculty and lecturer information
- **Matakuliah**: Course catalog and curriculum
- **JadwalKuliah**: Class schedules and timetables
- **KRS**: Course registration data
- **Nilai**: Grades and academic performance
- **Absensi**: Attendance tracking
- **Notifikasi**: System notifications
- **AuditLog**: Activity logging for security

See `docs/database-design.md` for complete ERD and schema details.

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run linting
npm run prisma:studio # Open Prisma Studio
```

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run test         # Run tests
npm run lint         # Run linting
npm run preview      # Preview production build
```

### Database Management
```bash
cd backend
npm run prisma:migrate      # Run database migrations
npm run prisma:generate     # Generate Prisma client
npm run prisma:seed         # Seed database with sample data
npm run prisma:studio       # Open database GUI
```

## 📚 API Documentation

Once the backend is running, visit:
- **API Documentation (Swagger UI)**: http://localhost:3001/api-docs
- **OpenAPI JSON**: http://localhost:3001/api-docs.json
- **Health Check**: http://localhost:3001/health

Spesifikasi OpenAPI ada di `postman/specs/website-akademik-api.yaml` dan menjadi satu-satunya
sumber dokumentasi (dipakai Swagger UI dan Postman). Saat menambah atau mengubah endpoint,
perbarui file tersebut lalu jalankan `postman spec lint postman/specs/website-akademik-api.yaml`.
Swagger UI aktif secara default kecuali di production (atur dengan `SWAGGER_ENABLED`).

### API Endpoints

#### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

#### Academic Management
- `GET /api/mahasiswa` - Get students list
- `POST /api/mahasiswa` - Create new student
- `PUT /api/mahasiswa/:nim` - Update student data
- `DELETE /api/mahasiswa/:nim` - Delete student

- `GET /api/dosen` - Get lecturers list
- `POST /api/dosen` - Create new lecturer
- `PUT /api/dosen/:nidn` - Update lecturer data
- `DELETE /api/dosen/:nidn` - Delete lecturer

- `GET /api/matakuliah` - Get courses list
- `POST /api/matakuliah` - Create new course
- `PUT /api/matakuliah/:kode` - Update course data
- `DELETE /api/matakuliah/:kode` - Delete course

And many more... See the full API documentation for details.

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permission system
- **Password Security**: Bcrypt hashing with salt rounds
- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Configuration**: Proper cross-origin resource sharing
- **Audit Logging**: Complete activity tracking
- **SQL Injection Prevention**: Parameterized queries with Prisma

## 📈 Performance Optimizations

- **Database Indexing**: Strategic indexes for query performance
- **Connection Pooling**: Efficient database connection management
- **Caching**: Redis caching for frequently accessed data
- **Code Splitting**: Frontend code optimization
- **Image Optimization**: Automatic image compression
- **Compression**: Gzip compression for responses
- **Lazy Loading**: On-demand component loading

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm run test              # Run all tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Generate coverage report
```

### Frontend Tests
```bash
cd frontend
npm run test              # Run all tests
npm run test:ui          # Run tests with UI
npm run test:coverage     # Generate coverage report
```

## 🚀 Deployment

### Production Deployment with Docker
```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale backend=3 --scale frontend=2
```

### Manual Deployment
1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations
4. Build and deploy backend
5. Build and deploy frontend
6. Set up reverse proxy (Nginx)
7. Configure SSL certificates

## 📝 Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/db_akademik"
JWT_SECRET="your-super-secret-jwt-key"
JWT_REFRESH_SECRET="your-super-secret-refresh-key"
PORT=3001
NODE_ENV="production"
CORS_ORIGIN="https://yourdomain.com"
```

### Frontend (.env)
```env
VITE_API_URL="https://api.yourdomain.com"
VITE_APP_NAME="Academic Information System"
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation in the `docs/` folder

## 🗺️ Roadmap

- [ ] Mobile application (React Native)
- [ ] Advanced analytics and reporting
- [ ] Integration with external systems
- [ ] AI-powered academic recommendations
- [ ] Multi-language support
- [ ] Advanced notification system
- [ ] Real-time collaboration features
- [ ] Blockchain-based certificate verification

---

**Built with ❤️ for Academic Excellence**
