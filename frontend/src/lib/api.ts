import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from './types';

const ACCESS = 'siakad.accessToken';
const REFRESH = 'siakad.refreshToken';

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

export const tokens = {
  get access() {
    return read(ACCESS);
  },
  get refresh() {
    return read(REFRESH);
  },
  set(access: string, refresh: string) {
    try {
      localStorage.setItem(ACCESS, access);
      localStorage.setItem(REFRESH, refresh);
    } catch {
      /* storage unavailable — session lasts until reload */
    }
  },
  clear() {
    try {
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
    } catch {
      /* ignore */
    }
  },
};

/** Fired when the session can no longer be refreshed; AuthProvider listens and logs out. */
export const SESSION_EXPIRED = 'siakad:session-expired';

export const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Share a single in-flight refresh between concurrent 401s.
let refreshing: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = tokens.refresh;
  if (!refreshToken) throw new Error('no refresh token');
  const { data } = await axios.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
    '/api/auth/refresh-token',
    { refreshToken }
  );
  tokens.set(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
};

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const isAuthCall = original?.url?.startsWith('/auth/login') || original?.url?.startsWith('/auth/refresh-token');
    if (error.response?.status === 401 && original && !original._retry && !isAuthCall && tokens.refresh) {
      original._retry = true;
      try {
        refreshing ??= refreshAccessToken().finally(() => (refreshing = null));
        const access = await refreshing;
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      } catch {
        tokens.clear();
        window.dispatchEvent(new Event(SESSION_EXPIRED));
      }
    }
    return Promise.reject(error);
  }
);

/** Human-readable message from an API error (validation details included). */
export const errorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as Partial<ApiResponse<{ errors?: string[] }>> | undefined;
    const details = body?.data?.errors;
    if (details?.length) return details.join(', ');
    if (body?.message) return body.message;
    if (!err.response) return 'Tidak dapat terhubung ke server';
  }
  return 'Terjadi kesalahan';
};

export const get = async <T>(url: string, params?: Record<string, unknown>) =>
  (await api.get<ApiResponse<T>>(url, { params })).data;
export const post = async <T>(url: string, body?: unknown) => (await api.post<ApiResponse<T>>(url, body)).data;
export const put = async <T>(url: string, body?: unknown) => (await api.put<ApiResponse<T>>(url, body)).data;
export const del = async <T>(url: string) => (await api.delete<ApiResponse<T>>(url)).data;
