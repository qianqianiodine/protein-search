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
  // 去重：同 doi + uniprot 不重复添加
  const exists = entries.some(
    (e) => e.doi === entry.doi && e.uniprot === entry.uniprot,
  );
  if (!exists) {
    entries.push(entry);
    saveSummary(entries);
  }
}

export function removeFromSummary(id: string): void {
  const entries = loadSummary().filter((e) => e.id !== id);
  saveSummary(entries);
}

export function isInSummary(doi: string, uniprot: string): boolean {
  return loadSummary().some((e) => e.doi === doi && e.uniprot === uniprot);
}
