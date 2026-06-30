import type { ArticleExtraction } from '../../shared/types';

const STORAGE_KEY = 'article-extraction-history';
const MAX_ENTRIES = 50;

export interface ArticleHistoryEntry {
  id: string;
  doi: string;
  pdbId: string;
  uniprot: string;
  proteinName: string;
  gene: string;
  title: string;
  extraction: ArticleExtraction;
  timestamp: number;
}

/** 读取全部历史（最新在前） */
export function loadAllArticleHistory(): ArticleHistoryEntry[] {
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

/** 按 doi + uniprot 查找缓存 */
export function loadArticleExtraction(
  doi: string,
  uniprot: string,
): ArticleHistoryEntry | null {
  return loadAllArticleHistory().find(
    (e) => e.doi === doi && e.uniprot === uniprot,
  ) || null;
}

/** 按唯一 ID 查找缓存（无 DOI 文献的兜底方案） */
export function loadArticleExtractionById(
  id: string,
): ArticleHistoryEntry | null {
  return loadAllArticleHistory().find((e) => e.id === id) || null;
}

/** 保存提取结果，相同 doi+uniprot 覆盖旧条目 */
export function saveArticleExtraction(entry: ArticleHistoryEntry): void {
  const history = loadAllArticleHistory();

  // 去重：相同 doi + uniprot 覆盖（doi 为空说明是手动上传，不做去重，每条独立）
  const idx = entry.doi
    ? history.findIndex(
        (e) => e.doi === entry.doi && e.uniprot === entry.uniprot,
      )
    : -1;
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
    history.length = Math.floor(MAX_ENTRIES / 2);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      // 放弃保存
    }
  }
}

/** 删除单条历史 */
export function deleteArticleHistory(id: string): void {
  const history = loadAllArticleHistory().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/** 按 uniprot + gene 模糊查找（无 DOI 文献从汇总页跳回详情页的兜底） */
export function findExtractionByProtein(
  uniprot: string,
  gene?: string,
): ArticleHistoryEntry | null {
  const all = loadAllArticleHistory();
  // 优先精确匹配 uniprot + gene
  if (gene) {
    const match = all.find((e) => e.uniprot === uniprot && e.gene === gene);
    if (match) return match;
  }
  // 回退：仅按 uniprot 匹配（取最新）
  return all.find((e) => e.uniprot === uniprot) || null;
}

/** 按 doi + uniprot 删除匹配的提取缓存 */
export function deleteArticleExtractionsByKeys(
  pairs: Array<{ doi: string; uniprot: string }>,
): void {
  const keys = new Set(pairs.map((p) => `${p.doi}|${p.uniprot}`));
  const remaining = loadAllArticleHistory().filter(
    (e) => !keys.has(`${e.doi}|${e.uniprot}`),
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
