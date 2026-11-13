import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, Users, ArrowRight } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="relative overflow-hidden selection:bg-primary-500 selection:text-white">
      {/* Decorative Orbs */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 rounded-full bg-primary-500/20 blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full bg-blue-500/10 blur-3xl animate-float"></div>

      {/* Navbar */}
      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-2 text-primary-400">
          <GraduationCap className="h-8 w-8" />
          <span className="text-xl font-bold tracking-tight text-white">SIAKAD</span>
        </div>
        <div className="hidden md:flex space-x-8 text-sm font-medium text-slate-300">
          <a href="#" className="hover:text-primary-400 transition-colors">Beranda</a>
          <a href="#" className="hover:text-primary-400 transition-colors">Fakultas</a>
          <a href="#" className="hover:text-primary-400 transition-colors">Pendaftaran</a>
          <a href="#" className="hover:text-primary-400 transition-colors">Kontak</a>
        </div>
        <div>
          <Link to="/login" className="btn-secondary mr-4">Login Dosen</Link>
          <Link to="/login" className="btn-primary">Portal Mahasiswa</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 flex flex-col lg:flex-row items-center">
        
        {/* Left Text */}
        <div className="lg:w-1/2 text-center lg:text-left pt-12 lg:pr-8">
          <div className="inline-block px-4 py-1.5 rounded-full glass-panel text-primary-400 text-xs font-semibold tracking-wider uppercase mb-6 shadow-primary-500/10">
            Platform Akademik Generasi Baru
          </div>
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-8">
            Digitalisasi <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-emerald-300">Kampus</span> Masa Depan
          </h1>
          <p className="text-lg text-slate-400 mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
            Kelola jadwal akademik, pembayaran UKT via Midtrans secara real-time, dan pantau kemajuan kelas dengan ekosistem terpadu bergaya modern.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start space-y-4 sm:space-y-0 sm:space-x-4">
            <Link to="/login" className="w-full sm:w-auto btn-primary flex items-center justify-center text-lg px-8 py-3">
              Masuk Portal <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <a href="#features" className="w-full sm:w-auto btn-secondary flex items-center justify-center text-lg px-8 py-3">
              Pelajari Fitur
            </a>
          </div>
        </div>

        {/* Right Metric Cards */}
        <div className="lg:w-1/2 mt-20 lg:mt-0 relative w-full perspective-1000">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
          
          <div className="grid grid-cols-2 gap-6 relative z-10">
            <div className="glass-card flex flex-col items-center text-center transform translate-y-8 animate-float" style={{ animationDelay: '0s' }}>
              <div className="bg-primary-500/20 p-4 rounded-full mb-4">
                <Users className="h-8 w-8 text-primary-400" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-1">12,000+</h3>
              <p className="text-sm text-slate-400">Mahasiswa Aktif</p>
            </div>
            
            <div className="glass-card flex flex-col items-center text-center animate-float" style={{ animationDelay: '1s' }}>
              <div className="bg-blue-500/20 p-4 rounded-full mb-4">
                <BookOpen className="h-8 w-8 text-blue-400" />
              </div>
              <h3 className="text-3xl font-bold text-white mb-1">340+</h3>
              <p className="text-sm text-slate-400">Mata Kuliah</p>
            </div>
            
            <div className="col-span-2 glass-card mt-4 flex items-center p-6 hover:shadow-emerald-500/10 hover:border-emerald-500/30">
              <div className="bg-emerald-500/20 p-4 rounded-full mr-6">
                <svg className="h-8 w-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white mb-1">100% Terintegrasi</h3>
                <p className="text-sm text-slate-400">Pembayaran SPP & UKT otomatis via Midtrans didukung validasi real-time webhook.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export default LandingPage;
