import { useState, useEffect } from 'react';
import { CreditCard, History, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Declare snap global variable
declare global {
  interface Window {
    snap: any;
  }
}

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILED'>('IDLE');

  // Load Midtrans snap.js only on this page instead of on every page via index.html
  useEffect(() => {
    if (window.snap || document.getElementById('midtrans-snap')) return;
    const script = document.createElement('script');
    script.id = 'midtrans-snap';
    script.src = 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.dataset.clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY ?? 'SB-Mid-client-XXXXX';
    document.body.appendChild(script);
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    setPaymentStatus('IDLE');
    
    try {
      // In a real application, you would make an API call to your backend:
      // const response = await axios.post('http://localhost:3006/api/payment/token', { tagihanId: 1 });
      // const { token } = response.data.data;
      
      // FOR DEMONSTRATION PURPOSES (since backend token needs active credentials)
      // Normally: window.snap.pay(token);
      
      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Using a mock interaction for presentation 
      // If snap is ready, show it. But we don't have a real token here in the mock.
      alert('Fitur Pembayaran Snap akan dipicu disini menggunakan metode window.snap.pay(TOKEN_DARI_BACKEND).');
      
      // Mock Success
      setPaymentStatus('SUCCESS');
      
    } catch (error) {
      console.error('Payment failed', error);
      setPaymentStatus('FAILED');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pt-6 pb-20 px-6">
      
      {/* Header */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Portal Mahasiswa</h1>
          <p className="text-slate-400">Selamat datang kembali, Budi Santoso</p>
        </div>
        <Link to="/" className="text-slate-400 hover:text-white transition-colors">
          &larr; Kembali
        </Link>
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Left Sidebar Profile */}
        <div className="md:col-span-1 space-y-6">
          <div className="glass-card flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary-500 to-blue-500 p-1 mb-4">
              <div className="w-full h-full rounded-full bg-dark-800 flex items-center justify-center">
                <User className="h-10 w-10 text-slate-300" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">Budi Santoso</h2>
            <p className="text-primary-400 font-medium mb-1">NIM: 2021001001</p>
            <p className="text-slate-400 text-sm mb-4">Teknik Informatika (2021)</p>
            <div className="w-full bg-dark-900 rounded-lg p-3 text-center border border-slate-700">
              <span className="text-xs text-slate-500 block mb-1">Status Akademik</span>
              <span className="text-emerald-400 font-bold tracking-wider">AKTIF</span>
            </div>
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-700/50 bg-dark-800/80">
              <h3 className="font-semibold text-white flex items-center">
                <History className="h-4 w-4 mr-2 text-slate-400" /> Histori Transaksi
              </h3>
            </div>
            <div className="p-0">
              <div className="p-4 border-b border-slate-700/30 flex justify-between items-center hover:bg-dark-700/30 transition-colors">
                <div>
                  <p className="text-sm text-white font-medium">UKT Semester Ganjil</p>
                  <p className="text-xs text-slate-500">12 Sep 2023</p>
                </div>
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">Lunas</span>
              </div>
              <div className="p-4 flex justify-between items-center hover:bg-dark-700/30 transition-colors">
                <div>
                  <p className="text-sm text-white font-medium">SPP Bulan Januari</p>
                  <p className="text-xs text-slate-500">05 Jan 2024</p>
                </div>
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded border border-emerald-500/30">Lunas</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Content */}
        <div className="md:col-span-2 space-y-6">
          
          {paymentStatus === 'SUCCESS' && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start">
              <CheckCircle2 className="h-6 w-6 text-emerald-400 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-emerald-400 font-semibold mb-1">Pembayaran Berhasil!</h4>
                <p className="text-sm text-emerald-400/80">Sistem telah memverifikasi pembayaran Anda melalui webhook Midtrans. Status tagihan telah diperbarui secara otomatis.</p>
              </div>
            </div>
          )}

          <div className="glass-card relative overflow-hidden">
            {/* Highlight beam */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            
            <div className="flex justify-between items-end mb-6 relative z-10">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center">
                  <CreditCard className="h-6 w-6 mr-3 text-primary-500" />
                  Tagihan Aktif
                </h2>
                <p className="text-slate-400">Segera lunasi tagihan Anda sebelum tenggat waktu.</p>
              </div>
            </div>

            <div className="bg-dark-900 border border-slate-700 rounded-xl p-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between">
                <div>
                  <div className="flex items-center mb-2">
                    <span className="px-2 py-0.5 bg-rose-500/20 text-rose-400 text-xs font-bold uppercase rounded border border-rose-500/30 mr-3">Belum Lunas</span>
                    <span className="text-slate-400 text-sm">Jatuh Tempo: 15 Maret 2024</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">SPP Semester Genap 2023/2024</h3>
                  <p className="text-sm text-slate-500">Tagihan wajib SPP perkuliahan semester genap.</p>
                </div>
                
                <div className="mt-6 md:mt-0 md:text-right">
                  <p className="text-sm text-slate-400 mb-1">Total Kewajiban</p>
                  <p className="text-3xl font-bold text-primary-400 mb-4">Rp 4.500.000</p>
                  
                  {paymentStatus !== 'SUCCESS' ? (
                    <button 
                      onClick={handlePayment} 
                      disabled={loading}
                      className="btn-primary w-full md:w-auto h-12 relative overflow-hidden group"
                    >
                      <span className={`flex items-center justify-center transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                        Bayar Sekarang via Midtrans
                      </span>
                      {loading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        </div>
                      )}
                    </button>
                  ) : (
                    <button disabled className="bg-emerald-500/20 text-emerald-400 font-medium py-2 px-6 rounded-xl border border-emerald-500/30 cursor-not-allowed flex items-center mx-auto md:ml-auto md:mr-0">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> Sudah Dibayar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-start p-4 bg-blue-500/5 rounded-lg border border-blue-500/20 relative z-10">
              <AlertCircle className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-300/80 leading-relaxed">
                Pembayaran didukung oleh <strong>Midtrans Sandbox</strong>. Anda dapat menggunakan berbagai macam metode pembayaran seperti Credit Card, Virtual Account (BCA, Mandiri, BNI, dll), GoPay, dan ShopeePay.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
