// Calls to the server functions (Netlify Functions in netlify/functions).
// Each request carries the signed-in user's Firebase ID token; the function
// checks it and the user's role before doing anything.
import { auth } from '../lib/firebase';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function callFunction<T>(
  name: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; query?: Record<string, string> } = {},
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'Please sign in.');
  const token = await user.getIdToken();
  const qs = opts.query ? '?' + new URLSearchParams(opts.query).toString() : '';
  let res: Response;
  try {
    res = await fetch(`/.netlify/functions/${name}${qs}`, {
      method: opts.method ?? 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'The server could not be reached. This needs an internet connection.');
  }
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok) {
    const msg = type.includes('json') ? ((await res.json()) as { error?: string }).error : '';
    throw new ApiError(res.status, msg || `Server error (${res.status}).`);
  }
  return (type.includes('json') ? await res.json() : await res.text()) as T;
}
