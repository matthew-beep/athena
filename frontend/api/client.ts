import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = '/api';
// For SSE streaming, bypass the Next.js rewrite proxy (which buffers the response).
// The browser talks directly to the backend so tokens arrive as they're generated.
const STREAM_BASE_URL =
  typeof window !== 'undefined' && process.env.NEXT_PUBLIC_BACKEND_URL
    ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`
    : BASE_URL;

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    useAuthStore.getState().logout();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get<T>(path: string): Promise<T> {
    return fetch(`${BASE_URL}${path}`, {
      headers: getHeaders(),
    }).then((r) => handleResponse<T>(r));
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => handleResponse<T>(r));
  },

  delete<T>(path: string): Promise<T> {
    return fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: getHeaders(),
    }).then((r) => handleResponse<T>(r));
  },

  postStream(path: string, body: unknown): Promise<Response> {
    const token = useAuthStore.getState().token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    return fetch(`${STREAM_BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  },
};
