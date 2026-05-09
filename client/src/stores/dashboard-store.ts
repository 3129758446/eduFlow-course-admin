/* 
模块：工作台数据仓库（Zustand）
定位：管理统计卡片与图表数据加载状态与错误透传
数据流：fetchDashboard() -> set(data)；错误通过 auth store 的 setGlobalError 显示在布局
对外：data, loading, refresh()
用法：DashboardPage 挂载时调用 refresh() 拉取数据
*/
import { create } from 'zustand';
import { fetchDashboard } from '../api';
import type { DashboardData } from '../types';
import { appErrorMessage } from '../utils/text';
import { useAuthStore } from './auth-store';
import { registerStoreResetter } from './reset-registry';

type DashboardStore = {
  data: DashboardData | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

// 清除全局错误
function clearGlobalError() {
  useAuthStore.getState().setGlobalError('');
}

// 设置全局错误
function setGlobalError(error: unknown) {
  useAuthStore.getState().setGlobalError(appErrorMessage(error));
}

// 创建工作台数据仓库
export const useDashboardStore = create<DashboardStore>((set) => ({
  data: null,
  loading: true,
  refresh: async () => {
    set({ loading: true });

    try {
      const data = await fetchDashboard(); // 拉取工作台数据
      set({ data, loading: false });
      clearGlobalError();
    } catch (error) {
      set({ loading: false });
      setGlobalError(error);
    }
  },
}));

// 重置工作台数据仓库
registerStoreResetter(() => { 
  useDashboardStore.setState({
    data: null,
    loading: true,
  });
});
