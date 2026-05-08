import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { clearAuth, getAuthToken } from '../auth';
import type { ApiEnvelope } from '../types';

const http = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiEnvelope<unknown>;

    if (payload.code === 401) {
      clearAuth();
      throw new Error('登录已失效，请重新登录');
    }

    if (payload.code !== 0) {
      throw new Error(payload.msg || '请求失败');
    }

    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status;
    const message = error.response?.data?.msg || error.message || '请求失败';

    if (status === 401 || error.response?.data?.code === 401) {
      clearAuth();
      return Promise.reject(new Error('登录已失效，请重新登录'));
    }

    return Promise.reject(new Error(message));
  },
);

export async function request<T>(config: AxiosRequestConfig) {
  const response = await http.request<ApiEnvelope<T>>(config);
  return response.data.data;
}
