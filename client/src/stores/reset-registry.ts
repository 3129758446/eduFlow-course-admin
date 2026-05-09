/* 
模块：Store 重置注册表
定位：集中记录各个 store 的重置函数，提供统一的 resetAllStores()
场景：退出登录/401 失效时清空所有页面状态，避免脏数据泄漏到下个用户
用法：各 store 初始化后调用 registerStoreResetter(() => setState(...))
*/
const resetters = new Set<() => void>();

// 注册 store 重置函数
export function registerStoreResetter(resetter: () => void) {
  resetters.add(resetter);

  return () => {
    resetters.delete(resetter);
  };
}

// 重置所有 store 状态
export function resetAllStores() {
  resetters.forEach((resetter) => {
    resetter();
  });
}
