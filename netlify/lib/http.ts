// Small HTTP helpers shared by the Netlify Functions.

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

/** Turn any thrown error into a JSON response without leaking internals. */
export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json(e.status, { error: e.message });
  const code = (e as { code?: string }).code ?? '';
  if (code === 'auth/email-already-exists')
    return json(409, { error: 'An account with this email already exists.' });
  if (code === 'auth/user-not-found') return json(404, { error: 'That account no longer exists.' });
  console.error('[function error]', e);
  return json(500, { error: 'Something went wrong on the server. Please try again.' });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
