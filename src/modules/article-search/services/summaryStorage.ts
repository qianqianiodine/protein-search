import type { SummaryEntry } from '../../shared/types';

const STORAGE_KEY = 'article-summary-entries';
const ORDER_KEY = 'article-summary-protein-order';

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

/** 蛋白卡片显示顺序 */
export function loadProteinOrder(): string[] {
  try {
    const raw = localStorage.getItem(ORDER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveProteinOrder(keys: string[]): void {
  localStorage.setItem(ORDER_KEY, JSON.stringify(keys));
}

/** 判断两个条目是否匹配（与 addToSummary 去重逻辑一致） */
function isSameEntry(a: { doi: string; uniprot: string; gene?: string; title?: string }, b: SummaryEntry): boolean {
  if (a.doi !== b.doi) return false;
  if (a.uniprot !== b.uniprot) return false;
  if (a.doi) return true;  // 有 DOI → 同 doi+uniprot 即为同一篇
  // 无 DOI → 额外检查 gene 和 title
  return a.gene === b.gene && a.title === b.title;
}

export function addToSummary(entry: SummaryEntry): void {
  const entries = loadSummary();
  const idx = entries.findIndex((e) => isSameEntry(entry, e));
  if (idx !== -1) {
    entries[idx] = entry;  // 覆盖旧条目（可能缺少 summaries）
  } else {
    entries.push(entry);
    // 新蛋白 → 加入排序列表末尾
    const proteinKey = entry.uniprot || entry.gene || '__unknown__';
    const order = loadProteinOrder();
    if (!order.includes(proteinKey)) {
      order.push(proteinKey);
      saveProteinOrder(order);
    }
  }
  saveSummary(entries);
}

export function removeFromSummary(id: string): void {
  const entries = loadSummary().filter((e) => e.id !== id);
  saveSummary(entries);
}

/** 检查是否已加入汇总。无 DOI 时需传 gene + title 精确匹配（同蛋白可能有不同文献） */
export function isInSummary(doi: string, uniprot: string, gene?: string, title?: string): boolean {
  return loadSummary().some((e) =>
    isSameEntry({ doi, uniprot, gene, title }, e),
  );
}

/** 在汇总中查找匹配条目（用于移除时获取正确 id），匹配逻辑与 addToSummary 一致 */
export function findSummaryEntry(doi: string, uniprot: string, gene?: string, title?: string): SummaryEntry | undefined {
  return loadSummary().find((e) =>
    isSameEntry({ doi, uniprot, gene, title }, e),
  );
}
