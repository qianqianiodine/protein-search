import type { SummaryEntry } from '../../shared/types';

const STORAGE_KEY = 'article-summary-entries';

export function loadSummary(): SummaryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSummary(entries: SummaryEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addToSummary(entry: SummaryEntry): void {
  const entries = loadSummary();
  // 去重：同 doi + uniprot 覆盖旧条目（确保重新提取后带 summaries 的结果能更新旧数据）
  // 无 DOI 时（手动提交）额外用 gene + title 去重
  const idx = entries.findIndex((e) => {
    if (e.doi === entry.doi && e.uniprot === entry.uniprot) {
      if (entry.doi) return true;               // 有 DOI → 同 doi+uniprot 即为重复
      // 无 DOI → 额外检查 gene 和 title，避免拦截同一蛋白的不同手动文献
      return e.gene === entry.gene && e.title === entry.title;
    }
    return false;
  });
  if (idx !== -1) {
    entries[idx] = entry;  // 覆盖旧条目（可能缺少 summaries）
  } else {
    entries.push(entry);
  }
  saveSummary(entries);
}

export function removeFromSummary(id: string): void {
  const entries = loadSummary().filter((e) => e.id !== id);
  saveSummary(entries);
}

export function isInSummary(doi: string, uniprot: string): boolean {
  return loadSummary().some((e) => e.doi === doi && e.uniprot === uniprot);
}
