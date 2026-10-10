import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { Role } from '../lib/types';

interface AuthValue {
  user: User | null;
  role: Role; // defaults to 'cashier' (least privilege) when no owner claim
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

const ROLE_KEY = 'aviz.role.';
const ROLE_WAIT_MS = 4000;

function rememberedRole(uid: string): Role {
  try {
    return localStorage.getItem(ROLE_KEY + uid) === 'owner' ? 'owner' : 'cashier';
  } catch {
    return 'cashier';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('cashier');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setRole('cashier');
        setLoading(false);
        return;
      }
      // Role comes from a custom claim set server-side (owner|cashier). Reading
      // it may need to renew the sign-in token, which needs the internet. When
      // the app is opened offline or on a very slow line, use the role this
      // device saw last time instead of waiting, so billing opens at once. (The
      // role only shapes the screens; the security rules check the real token.)
      let settled = false;
      const fallback = setTimeout(() => {
        settled = true;
        setRole(rememberedRole(u.uid));
        setLoading(false);
      }, ROLE_WAIT_MS);
      u.getIdTokenResult()
        .then((token) => {
          const r: Role = token.claims.role === 'owner' ? 'owner' : 'cashier';
          try {
            localStorage.setItem(ROLE_KEY + u.uid, r);
          } catch {
            /* storage unavailable */
          }
          setRole(r);
        })
        .catch(() => {
          if (!settled) setRole(rememberedRole(u.uid));
        })
        .finally(() => {
          clearTimeout(fallback);
          setLoading(false);
        });
    });
    return unsub;
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      role,
      loading,
      signIn: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signOutUser: async () => {
        await signOut(auth);
      },
    }),
    [user, role, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
