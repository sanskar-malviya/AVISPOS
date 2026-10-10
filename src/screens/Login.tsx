import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';

export function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      setError(
        code.includes('invalid') || code.includes('wrong') || code.includes('not-found')
          ? 'Incorrect email or password.'
          : 'Could not sign in. Please check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  // Already signed in → go to billing.
  if (user) return <Navigate to="/" replace />;

  return (
    <div className="h-full grid place-items-center bg-brand-50 p-4">
      <form onSubmit={onSubmit} className="card w-[min(92vw,26rem)] p-7">
        <div className="text-center mb-6">
          <img
            src="/brand/logo.jpg"
            alt=""
            className="mx-auto mb-3 w-32 h-32 rounded-full object-cover shadow-md"
            draggable={false}
          />
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-bold bg-veg-600 text-white rounded px-1.5 py-0.5">
              VEG
            </span>
            <span className="text-2xl font-extrabold text-tandoori-700">
              AVI'S FOOD CORNER
            </span>
          </div>
          <p className="text-stone-500 mt-1">Point of Sale — sign in</p>
        </div>

        <label className="block text-sm font-semibold text-stone-700 mb-1">
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 mb-4 focus:border-tandoori-700 outline-none"
          required
        />

        <label className="block text-sm font-semibold text-stone-700 mb-1">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border-2 border-stone-200 px-4 py-3 mb-4 focus:border-tandoori-700 outline-none"
          required
        />

        {error && (
          <div className="mb-4 text-sm font-semibold text-red-700 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button type="submit" className="btn-primary w-full text-lg h-14" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
