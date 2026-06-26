import type { ProteinSearchState } from '../../shared/types';

const STATE_KEY = 'protein-search-state';

/**
 * 保存当前 protein-search 状态（含滚动位置）
 * 用于进入 article-search 前暂存
 */
export function saveProteinSearchState(state: ProteinSearchState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      ...state,
      scrollPosition: window.scrollY,
    }));
  } catch {
    // 静默失败 — history 会兜底
  }
}

/**
 * 恢复之前保存的 protein-search 状态
 * 不删除 — 保留以支持页面刷新恢复
 */
export function restoreProteinSearchState(): ProteinSearchState | null {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProteinSearchState;
  } catch {
    return null;
  }
}

/**
 * 恢复滚动位置（需在 componentDidMount 后调用）
 */
export function restoreScrollPosition(position: number): void {
  requestAnimationFrame(() => {
    window.scrollTo(0, position);
  });
}
