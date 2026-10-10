import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './auth';

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="h-full grid place-items-center text-stone-500 font-medium">
      {children}
    </div>
  );
}

/** Requires an authenticated user; otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Requires the owner role; cashiers are sent back to billing. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <FullScreenMessage>Loading…</FullScreenMessage>;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'owner') return <Navigate to="/" replace />;
  return <>{children}</>;
}
