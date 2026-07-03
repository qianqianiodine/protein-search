const PREFIX = 'scroll-pos:';

/** 保存当前页面滚动位置到 sessionStorage */
export function saveScrollPosition(key: string): void {
  try {
    sessionStorage.setItem(PREFIX + key, String(window.scrollY));
  } catch {
    // 静默失败
  }
}

/** 从 sessionStorage 恢复滚动位置（恢复后立即清除，避免新鲜访问误恢复） */
export function restoreScrollPosition(key: string): void {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return;
    sessionStorage.removeItem(PREFIX + key);
    const pos = parseInt(raw, 10);
    if (!isNaN(pos) && pos > 0) {
      requestAnimationFrame(() => window.scrollTo(0, pos));
    }
  } catch {
    // 静默失败
  }
}
