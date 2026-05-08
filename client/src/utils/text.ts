export function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

export function appErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return '请求失败，请稍后重试';
}

export function parseMaybeChinese(value: string) {
  try {
    return decodeURIComponent(escape(value));
  } catch {
    return value;
  }
}

export function trimLabel(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}
