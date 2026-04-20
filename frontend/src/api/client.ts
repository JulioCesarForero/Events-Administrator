/**
 * Centralized HTTP client.
 *
 * Responsibilities:
 * - BaseURL via `VITE_API_BASE_URL` (falls back to `/api/v1` during dev).
 * - Optional `Authorization: Bearer <token>` injection.
 * - Automatic `Idempotency-Key` for POST to known idempotent routes.
 * - Dual error parser that understands both `{ error: { code, message, correlationId } }`
 *   and the legacy RFC 7807 flat body.
 * - Preserves the current call shape (`apiClient.get/post/patch/put/delete`) so
 *   existing pages keep working without changes.
 */

export interface ApiError extends Error {
  status: number;
  code?: string;
  correlationId?: string;
  payload?: unknown;
}

type LegacyOptions = {
  token?: string;
  isBearer?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /**
   * Set to `false` to skip the automatic Idempotency-Key injection (useful
   * in tests or when the caller already provides one in headers).
   */
  idempotency?: boolean | string;
};

const BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_API_BASE_URL || '/api/v1';

const DEFAULT_TIMEOUT_MS = Number(
  (import.meta as unknown as { env?: Record<string, string> })?.env
    ?.VITE_API_TIMEOUT_MS || '20000',
);

const IDEMPOTENT_POSTS: RegExp[] = [
  /^\/events\/[^/]+\/reservations\/?$/,
  /^\/payments\/[^/]+\/approve\/?$/,
  /^\/events\/[^/]+\/cash-payments\/?$/,
  /^\/events\/[^/]+\/student-imports\/?$/,
];

function isIdempotentPath(path: string): boolean {
  return IDEMPOTENT_POSTS.some((re) => re.test(path));
}

function generateIdempotencyKey(): string {
  const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  // Fallback for older runtimes.
  return (
    'idem-' +
    Date.now().toString(16) +
    '-' +
    Math.random().toString(16).slice(2, 10)
  );
}

function buildError(status: number, body: unknown): ApiError {
  const payload = body as
    | {
        error?: { code?: string; message?: string; correlationId?: string };
        code?: string;
        detail?: unknown;
        title?: string;
        correlationId?: string;
      }
    | string
    | undefined;

  let code: string | undefined;
  let message = 'Error en la petición';
  let correlationId: string | undefined;

  if (typeof payload === 'object' && payload !== null) {
    const env = payload.error;
    code = env?.code || payload.code;
    correlationId = env?.correlationId || payload.correlationId;
    const detail = payload.detail;
    message =
      env?.message ||
      (typeof detail === 'string' ? detail : undefined) ||
      (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object'
        ? (detail[0] as { msg?: string }).msg
        : undefined) ||
      payload.title ||
      message;
  } else if (typeof payload === 'string' && payload.length > 0) {
    message = payload;
  }

  const err: ApiError = Object.assign(new Error(message), {
    status,
    code,
    correlationId,
    payload,
  });
  return err;
}

async function fetchApi<T>(
  endpoint: string,
  method: string,
  body?: unknown,
  options: LegacyOptions = {},
): Promise<T> {
  const { token, isBearer, headers, signal, idempotency } = options;

  const authHeader = token
    ? { Authorization: isBearer ? `Bearer ${token}` : token }
    : undefined;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(authHeader || {}),
    ...(headers || {}),
  };

  if (method === 'POST' && idempotency !== false) {
    if (typeof idempotency === 'string' && idempotency.length > 0) {
      finalHeaders['Idempotency-Key'] =
        finalHeaders['Idempotency-Key'] || idempotency;
    } else if (isIdempotentPath(endpoint) && !finalHeaders['Idempotency-Key']) {
      finalHeaders['Idempotency-Key'] = generateIdempotencyKey();
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const mergedSignal = signal
    ? mergeSignals(signal, controller.signal)
    : controller.signal;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: mergedSignal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      try {
        parsed = await response.text();
      } catch {
        parsed = undefined;
      }
    }
    throw buildError(response.status, parsed);
  }

  const text = await response.text();
  return (text ? JSON.parse(text) : ({} as T)) as T;
}

function mergeSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const ctrl = new AbortController();
  const onAbortA = () => ctrl.abort(a.reason);
  const onAbortB = () => ctrl.abort(b.reason);
  a.addEventListener('abort', onAbortA, { once: true });
  b.addEventListener('abort', onAbortB, { once: true });
  return ctrl.signal;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: LegacyOptions) =>
    fetchApi<T>(endpoint, 'GET', undefined, options),
  post: <T>(endpoint: string, body?: unknown, options?: LegacyOptions) =>
    fetchApi<T>(endpoint, 'POST', body ?? {}, options),
  put: <T>(endpoint: string, body?: unknown, options?: LegacyOptions) =>
    fetchApi<T>(endpoint, 'PUT', body ?? {}, options),
  patch: <T>(endpoint: string, body?: unknown, options?: LegacyOptions) =>
    fetchApi<T>(endpoint, 'PATCH', body ?? {}, options),
  delete: <T>(endpoint: string, options?: LegacyOptions) =>
    fetchApi<T>(endpoint, 'DELETE', undefined, options),
};

export { BASE_URL as API_BASE_URL };
