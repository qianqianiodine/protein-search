import type { UniProtCandidate } from '../../shared/types';
import styles from './UniProtSuggestions.module.css';

interface UniProtSuggestionsProps {
  candidates: UniProtCandidate[];
  loading: boolean;
  onSelect: (candidate: UniProtCandidate) => void;
  query?: string;
}

export function UniProtSuggestions({
  candidates,
  loading,
  onSelect,
  query,
}: UniProtSuggestionsProps) {
  if (loading && candidates.length === 0) {
    return <div className={styles.loading}>搜索中...</div>;
  }

  if (!loading && candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => {
    const scoreA = matchScore(a, query);
    const scoreB = matchScore(b, query);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.length - a.length;
  });

  return (
    <div className={styles.container}>
      {sorted.map((c) => (
        <button
          key={c.accession}
          className={styles.item}
          onClick={() => onSelect(c)}
        >
          <div>
            <div className={styles.name}>{c.name}</div>
            <div className={styles.meta}>
              {c.gene} · {c.organism}
            </div>
            {c.aliases.length > 0 && (
              <div className={styles.aliases}>
                别名: {c.aliases.join(', ')}
              </div>
            )}
          </div>
          <div className={styles.right}>
            <div className={styles.accession}>{c.accession}</div>
            <div className={styles.length}>{c.length} aa</div>
          </div>
        </button>
      ))}
    </div>
  );
}

/** 计算候选蛋白对搜索词 query 的匹配度 */
function matchScore(c: UniProtCandidate, query?: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const entryPart = c.uniProtId.toLowerCase().split('_')[0]; // e.g. "IDO1_HUMAN" → "ido1"
  const gene = c.gene.toLowerCase();
  const name = c.name.toLowerCase();

  // 完全匹配 entry name（基因部分）或 gene
  if (entryPart === q || gene === q) return 3;
  // entry name 或 gene 以 query 开头
  if (entryPart.startsWith(q) || gene.startsWith(q)) return 2;
  // entry name / gene / protein name 包含 query
  if (entryPart.includes(q) || gene.includes(q) || name.includes(q)) return 1;
  return 0;
}
