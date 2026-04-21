import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Button, Input, Label } from '../components/ui/Primitives.jsx';
import logoUrl from '../../Fundco.svg';

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(email, password, name || 'Analyst');
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--text-main)]">
      <div className="hidden flex-col justify-between border-r border-[var(--border-soft)] bg-[var(--surface-muted)] px-16 py-12 lg:flex lg:w-1/2">
        <div>
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="Logo" className="h-30 w-40 mt-10 object-contain" />
            <span className="text-2xl mt-10 font-semibold text-[var(--text-main)]">Capital Managers</span>
          </div>

          <div className="mt-20 max-w-md">
            <h1 className="text-3xl font-semibold leading-snug text-[var(--text-main)]">Project Finance Modeling System</h1>
            <p className="mt-4 text-sm leading-relaxed text-[var(--text-muted)]">
              Access financial models, review assumptions, and generate structured reports for stakeholders.
            </p>
          </div>
        </div>

        <div className="text-xs text-[var(--text-muted)]">© {new Date().getFullYear()} FundCo Capital Managers</div>
      </div>

      <div className="flex w-full items-center justify-center px-6 sm:px-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-main)]">{mode === 'login' ? 'Sign in' : 'Create account'}</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {mode === 'login' ? 'Enter your credentials to continue' : 'Set up your account to get started'}
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            {mode === 'register' && (
              <div>
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5" placeholder="" />
              </div>
            )}

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5" placeholder="name@fundco.ng" />
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5" placeholder="Enter your password" />
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>

            <div className="text-center text-sm text-[var(--text-muted)]">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="font-medium text-[var(--text-main)] hover:underline">
                {mode === 'login' ? 'Create one' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
