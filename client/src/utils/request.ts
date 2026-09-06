import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { clearAuth, getAuthToken, setAuth } from '../auth';
import type { ApiEnvelope, LoginResponse } from '../types';

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean; _skipRefresh?: boolean };

const http = axios.create({ baseURL: '/api', timeout: 10000, withCredentials: true });
let refreshPromise: Promise<LoginResponse> | null = null;

http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiEnvelope<unknown>;
    if (payload.code === 401) throw new Error('登录已失效，请重新登录');
    if (payload.code !== 0) throw new Error(payload.msg || '请求失败');
    return response;
  },
  async (error: AxiosError<ApiEnvelope<unknown>>) => {
    const config = error.config as RetryableConfig | undefined;
    const isUnauthorized = error.response?.status === 401 || error.response?.data?.code === 401;
    if (!isUnauthorized) return Promise.reject(new Error(error.response?.data?.msg || error.message || '请求失败'));
    if (!config || config._skipRefresh || config._retry) {
      clearAuth();
      return Promise.reject(new Error('登录已失效，请重新登录'));
    }
    try {
      const session = await refreshAccessToken();
      config._retry = true;
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${session.token}`;
      return http.request(config);
    } catch {
      clearAuth();
      return Promise.reject(new Error('登录已失效，请重新登录'));
    }
  },
);

export async function request<T>(config: AxiosRequestConfig) {
  const response = await http.request<ApiEnvelope<T>>(config);
  return response.data.data;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = http.request<ApiEnvelope<LoginResponse>>({
      url: '/auth/refresh',
      method: 'POST',
      _skipRefresh: true,
    } as RetryableConfig).then((response) => {
      if (response.data.code !== 0 || !response.data.data) throw new Error(response.data.msg || '刷新登录失败');
      setAuth(response.data.data.token);
      return response.data.data;
    }).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}
