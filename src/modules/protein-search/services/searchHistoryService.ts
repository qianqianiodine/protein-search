import type { SearchHistoryEntry } from '../../shared/types';

const STORAGE_KEY = 'protein-search-history';
const MAX_ENTRIES = 50;

/** 读取全部搜索历史（最新在前） */
export function loadHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/** 保存单条搜索历史（超过上限时移除最旧的） */
export function saveHistory(entry: SearchHistoryEntry): void {
  const history = loadHistory();
  // 去重：相同 query + taxId + accession 视为重复，替换旧条目
  const idx = history.findIndex(
    (h) =>
      h.query === entry.query &&
      h.taxId === entry.taxId &&
      h.protein.accession === entry.protein.accession,
  );
  if (idx !== -1) {
    history.splice(idx, 1);
  }

  history.unshift(entry);

  if (history.length > MAX_ENTRIES) {
    history.length = MAX_ENTRIES;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // localStorage 满了，移除最旧的再试一次
    history.length = MAX_ENTRIES / 2;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // 放弃保存
    }
  }
}

/** 删除单条搜索历史 */
export function deleteHistory(id: string): void {
  const history = loadHistory().filter((h) => h.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** 生成唯一 ID */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
