/*
模块：Store 错误桥接工具
定位：把页面级 store 的请求异常统一写入 auth store 的全局错误提示
说明：课程、学生、工作台、学习总结都复用这里，避免每个 store 重复写同样的错误转换逻辑。
*/
import { appErrorMessage } from "../utils/text";
import { useAuthStore } from "./auth-store";

export function clearGlobalError() {
  useAuthStore.getState().setGlobalError("");
}

export function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}
