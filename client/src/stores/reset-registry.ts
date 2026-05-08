const resetters = new Set<() => void>();

export function registerStoreResetter(resetter: () => void) {
  resetters.add(resetter);

  return () => {
    resetters.delete(resetter);
  };
}

export function resetAllStores() {
  resetters.forEach((resetter) => {
    resetter();
  });
}
