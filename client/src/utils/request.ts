/* 
模块：Axios 请求实例
定位：统一 baseURL/超时/鉴权/错误处理，输出轻量 request<T>() 帮助函数
数据流：请求前注入 Authorization，响应阶段按 ApiEnvelope(code/msg/data) 校验 -> 抛出 Error
用法：
- 仅从 api.ts 调用 request<T>(config)；不要在页面/Store中直接使用 axios
- 401 时自动 clearAuth 并由上层捕获提示，确保登录失效体验一致
学习要点：
- 响应拦截器中只返回 response，request<T> 再解包 data，既保留类型又集中处理错误
*/
import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { clearAuth, getAuthToken } from "../auth";
import type { ApiEnvelope } from "../types";

const http = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

http.interceptors.request.use((config) => {
  const token = getAuthToken();

  if (token) {
    // 所有受保护接口统一在这里注入 Bearer Token，业务层无需重复拼请求头。
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  return config;
});

http.interceptors.response.use(
  (response) => {
    const payload = response.data as ApiEnvelope<unknown>;

    // 后端采用业务 code 包裹 HTTP 200，这里优先按统一响应格式判断是否成功。
    if (payload.code === 401) {
      clearAuth();
      throw new Error("登录已失效，请重新登录");
    }

    if (payload.code !== 0) {
      throw new Error(payload.msg || "请求失败");
    }

    return response;
  },
  (error: AxiosError<ApiEnvelope<unknown>>) => {
    const status = error.response?.status;
    const message = error.response?.data?.msg || error.message || "请求失败";

    // 同时兼容 HTTP 401 和业务 code=401 两种失效场景。
    if (status === 401 || error.response?.data?.code === 401) {
      clearAuth();
      return Promise.reject(new Error("登录已失效，请重新登录"));
    }

    return Promise.reject(new Error(message));
  },
);

export async function request<T>(config: AxiosRequestConfig) {
  // 统一在这一层解包 data，页面和 store 只面向业务数据类型 T。
  const response = await http.request<ApiEnvelope<T>>(config);
  return response.data.data;
}
