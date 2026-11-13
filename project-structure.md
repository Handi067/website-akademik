# Project Structure - Modern Academic Information System

## Overview
This project follows a monorepo structure with separate backend and frontend applications for better scalability and maintainability.

## Directory Structure

```
website-akademik/
├── backend/                          # Node.js + Express + TypeScript API
│   ├── src/
│   │   ├── controllers/              # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── mahasiswa.controller.ts
│   │   │   ├── dosen.controller.ts
│   │   │   ├── matakuliah.controller.ts
│   │   │   ├── jadwal.controller.ts
│   │   │   ├── krs.controller.ts
│   │   │   ├── nilai.controller.ts
│   │   │   ├── absensi.controller.ts
│   │   │   ├── notifikasi.controller.ts
│   │   │   └── dashboard.controller.ts
│   │   ├── middleware/               # Custom middleware
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rbac.middleware.ts
│   │   │   ├── validation.middleware.ts
│   │   │   ├── audit.middleware.ts
│   │   │   └── error.middleware.ts
│   │   ├── models/                  # Data models
│   │   │   ├── user.model.ts
│   │   │   ├── mahasiswa.model.ts
│   │   │   ├── dosen.model.ts
│   │   │   ├── matakuliah.model.ts
│   │   │   ├── jadwal.model.ts
│   │   │   ├── krs.model.ts
│   │   │   ├── nilai.model.ts
│   │   │   ├── absensi.model.ts
│   │   │   └── notifikasi.model.ts
│   │   ├── routes/                   # API routes
│   │   │   ├── index.ts
│   │   │   ├── auth.routes.ts
│   │   │   ├── mahasiswa.routes.ts
│   │   │   ├── dosen.routes.ts
│   │   │   ├── matakuliah.routes.ts
│   │   │   ├── jadwal.routes.ts
│   │   │   ├── krs.routes.ts
│   │   │   ├── nilai.routes.ts
│   │   │   ├── absensi.routes.ts
│   │   │   ├── notifikasi.routes.ts
│   │   │   └── dashboard.routes.ts
│   │   ├── services/                 # Business logic
│   │   │   ├── auth.service.ts
│   │   │   ├── mahasiswa.service.ts
│   │   │   ├── dosen.service.ts
│   │   │   ├── matakuliah.service.ts
│   │   │   ├── jadwal.service.ts
│   │   │   ├── krs.service.ts
│   │   │   ├── nilai.service.ts
│   │   │   ├── absensi.service.ts
│   │   │   ├── notifikasi.service.ts
│   │   │   ├── email.service.ts
│   │   │   └── export.service.ts
│   │   ├── utils/                    # Utility functions
│   │   │   ├── database.ts
│   │   │   ├── jwt.ts
│   │   │   ├── password.ts
│   │   │   ├── validation.ts
│   │   │   ├── logger.ts
│   │   │   └── constants.ts
│   │   ├── types/                    # TypeScript type definitions
│   │   │   ├── auth.types.ts
│   │   │   ├── user.types.ts
│   │   │   ├── academic.types.ts
│   │   │   └── api.types.ts
│   │   ├── config/                   # Configuration files
│   │   │   ├── database.ts
│   │   │   ├── jwt.ts
│   │   │   ├── email.ts
│   │   │   └── app.ts
│   │   └── app.ts                    # Express app setup
│   ├── prisma/                       # Prisma ORM
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── tests/                        # Test files
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── uploads/                      # File uploads
│   ├── logs/                         # Application logs
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── .env.example
├── frontend/                         # React + TypeScript
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── manifest.json
│   ├── src/
│   │   ├── components/               # Reusable components
│   │   │   ├── common/               # Common UI components
│   │   │   │   ├── Layout/
│   │   │   │   ├── Header/
│   │   │   │   ├── Sidebar/
│   │   │   │   ├── Loading/
│   │   │   │   ├── Modal/
│   │   │   │   └── Table/
│   │   │   ├── forms/                # Form components
│   │   │   │   ├── LoginForm/
│   │   │   │   ├── MahasiswaForm/
│   │   │   │   ├── DosenForm/
│   │   │   │   ├── MatakuliahForm/
│   │   │   │   ├── JadwalForm/
│   │   │   │   ├── KRSForm/
│   │   │   │   └── NilaiForm/
│   │   │   └── charts/               # Chart components
│   │   │       ├── BarChart/
│   │   │       ├── LineChart/
│   │   │       └── PieChart/
│   │   ├── pages/                    # Page components
│   │   │   ├── auth/
│   │   │   │   ├── Login.tsx
│   │   │   │   └── Register.tsx
│   │   │   ├── admin/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── MahasiswaManagement.tsx
│   │   │   │   ├── DosenManagement.tsx
│   │   │   │   ├── MatakuliahManagement.tsx
│   │   │   │   ├── JadwalManagement.tsx
│   │   │   │   └── SystemSettings.tsx
│   │   │   ├── dosen/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── KelolaNilai.tsx
│   │   │   │   ├── Absensi.tsx
│   │   │   │   └── JadwalMengajar.tsx
│   │   │   ├── mahasiswa/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── KRS.tsx
│   │   │   │   ├── KHS.tsx
│   │   │   │   ├── JadwalKuliah.tsx
│   │   │   │   └── Profil.tsx
│   │   │   └── NotFound.tsx
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useApi.ts
│   │   │   ├── useNotification.ts
│   │   │   └── useLocalStorage.ts
│   │   ├── services/                 # API services
│   │   │   ├── api.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── mahasiswa.service.ts
│   │   │   ├── dosen.service.ts
│   │   │   ├── matakuliah.service.ts
│   │   │   ├── jadwal.service.ts
│   │   │   ├── krs.service.ts
│   │   │   ├── nilai.service.ts
│   │   │   └── notifikasi.service.ts
│   │   ├── store/                    # State management (Redux Toolkit)
│   │   │   ├── index.ts
│   │   │   ├── authSlice.ts
│   │   │   ├── mahasiswaSlice.ts
│   │   │   ├── dosenSlice.ts
│   │   │   ├── matakuliahSlice.ts
│   │   │   ├── jadwalSlice.ts
│   │   │   ├── krsSlice.ts
│   │   │   ├── nilaiSlice.ts
│   │   │   └── notifikasiSlice.ts
│   │   ├── types/                    # TypeScript types
│   │   │   ├── auth.types.ts
│   │   │   ├── user.types.ts
│   │   │   ├── academic.types.ts
│   │   │   └── api.types.ts
│   │   ├── utils/                    # Utility functions
│   │   │   ├── constants.ts
│   │   │   ├── helpers.ts
│   │   │   ├── validation.ts
│   │   │   └── formatters.ts
│   │   ├── styles/                   # Styling
│   │   │   ├── globals.css
│   │   │   ├── variables.css
│   │   │   └── components.css
│   │   ├── App.tsx
│   │   ├── index.tsx
│   │   └── setupTests.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.js
├── docker/                           # Docker configurations
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   └── docker-compose.yml
├── docs/                             # Documentation
│   ├── api/                          # API documentation
│   │   ├── auth.md
│   │   ├── mahasiswa.md
│   │   ├── dosen.md
│   │   ├── matakuliah.md
│   │   ├── jadwal.md
│   │   ├── krs.md
│   │   ├── nilai.md
│   │   └── absensi.md
│   ├── deployment/
│   │   ├── docker.md
│   │   ├── ci-cd.md
│   │   └── production.md
│   └── user-guide/
│       ├── admin.md
│       ├── dosen.md
│       └── mahasiswa.md
├── scripts/                          # Utility scripts
│   ├── setup.sh
│   ├── seed-data.sh
│   ├── backup.sh
│   └── deploy.sh
├── .github/                          # GitHub Actions
│   └── workflows/
│       ├── ci.yml
│       ├── cd.yml
│       └── security.yml
├── .gitignore
├── README.md
├── docker-compose.yml
└── package.json                      # Root package.json for workspace management
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Validation**: Joi / Zod
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **File Upload**: Multer
- **Email**: Nodemailer

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router
- **UI Components**: Tailwind CSS + Headless UI
- **Forms**: React Hook Form + Zod
- **Charts**: Chart.js / Recharts
- **HTTP Client**: Axios
- **Testing**: Jest + React Testing Library
- **Build Tool**: Vite

### DevOps & Deployment
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Reverse Proxy**: Nginx
- **Process Manager**: PM2
- **Monitoring**: Application logs + health checks
- **Environment**: Environment variables with validation

## Key Features

### Security
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration
- Rate limiting
- Audit logging
- SQL injection prevention with Prisma

### Performance
- Database connection pooling
- Query optimization with proper indexing
- Caching strategies
- Lazy loading in frontend
- Code splitting
- Image optimization
- Compression middleware

### Scalability
- Modular architecture
- Microservices-ready structure
- Horizontal scaling support
- Load balancing ready
- Database sharding consideration

### User Experience
- Responsive design
- Real-time notifications
- Progressive Web App (PWA) features
- Offline support
- Accessibility (WCAG 2.1)
- Internationalization support

## Development Workflow

1. **Development Environment**
   - Use Docker Compose for local development
   - Hot reload for both frontend and backend
   - Database migrations with Prisma
   - Automated testing on file changes

2. **Code Quality**
   - ESLint + Prettier for code formatting
   - Husky for git hooks
   - TypeScript strict mode
   - Code coverage requirements
   - Pre-commit checks

3. **Testing Strategy**
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for critical user flows
   - Performance testing
   - Security testing

4. **Deployment Pipeline**
   - Automated testing on PR
   - Build and test on merge
   - Staging deployment
   - Production deployment with rollback capability
   - Health checks and monitoring
