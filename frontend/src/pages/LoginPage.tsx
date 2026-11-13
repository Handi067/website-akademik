import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { GraduationCap, LogIn } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { errorMessage } from '@/lib/api';
import { Field, Spinner } from '@/components/ui';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/app" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/app') ? from : '/app', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 text-primary-500 mb-8">
          <GraduationCap className="h-9 w-9" />
          <span className="text-2xl font-bold text-white">SIAKAD</span>
        </Link>
        <form onSubmit={submit} className="card p-8 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-white">Masuk</h1>
            <p className="text-sm text-slate-400 mt-1">Gunakan akun mahasiswa, dosen, atau admin.</p>
          </div>
          <Field label="Username atau email">
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-rose-400">
              {error}
            </p>
          )}
          <button className="btn-solid w-full h-11" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : <LogIn className="h-4 w-4" />} Masuk
          </button>
        </form>
      </div>
    </div>
  );
}
