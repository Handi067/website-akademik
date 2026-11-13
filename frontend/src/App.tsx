import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './auth/AuthContext';
import Layout, { RequireAuth } from './components/Layout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import MahasiswaPage from './pages/MahasiswaPage';
import DosenPage from './pages/DosenPage';
import MatakuliahPage from './pages/MatakuliahPage';
import JadwalPage from './pages/JadwalPage';
import KrsPage from './pages/KrsPage';
import KhsPage from './pages/KhsPage';
import TranskripPage from './pages/TranskripPage';
import NilaiPage from './pages/NilaiPage';
import TagihanDemo from './pages/Dashboard';

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen font-sans text-slate-200">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          {/* Prototype pembayaran Midtrans (data tiruan) */}
          <Route path="/tagihan-demo" element={<TagihanDemo />} />
          <Route
            path="/app"
            element={
              <RequireAuth>
                <Layout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="jadwal" element={<JadwalPage />} />
            <Route path="krs" element={<RequireAuth roles={['MAHASISWA']}><KrsPage /></RequireAuth>} />
            <Route path="khs" element={<RequireAuth roles={['MAHASISWA']}><KhsPage /></RequireAuth>} />
            <Route path="transkrip" element={<RequireAuth roles={['MAHASISWA']}><TranskripPage /></RequireAuth>} />
            <Route path="nilai" element={<RequireAuth roles={['DOSEN', 'ADMIN']}><NilaiPage /></RequireAuth>} />
            <Route path="matakuliah" element={<RequireAuth roles={['ADMIN']}><MatakuliahPage /></RequireAuth>} />
            <Route path="mahasiswa" element={<RequireAuth roles={['ADMIN']}><MahasiswaPage /></RequireAuth>} />
            <Route path="dosen" element={<RequireAuth roles={['ADMIN']}><DosenPage /></RequireAuth>} />
          </Route>
          <Route path="/dashboard" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster
          position="top-right"
          toastOptions={{ style: { background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155', fontSize: 14 } }}
        />
      </div>
    </AuthProvider>
  );
}

export default App;
