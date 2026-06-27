import type { UniProtCandidate } from '../../shared/types';
import styles from './UniProtSuggestions.module.css';

interface UniProtSuggestionsProps {
  candidates: UniProtCandidate[];
  loading: boolean;
  onSelect: (candidate: UniProtCandidate) => void;
}

export function UniProtSuggestions({
  candidates,
  loading,
  onSelect,
}: UniProtSuggestionsProps) {
  if (loading && candidates.length === 0) {
    return <div className={styles.loading}>搜索中...</div>;
  }

  if (!loading && candidates.length === 0) {
    return null;
  }

  // Swiss-Prot (reviewed) 优先，组内保持 API 默认相关性顺序
  const sorted = [...candidates].sort((a, b) => {
    if (a.reviewed !== b.reviewed) return a.reviewed ? -1 : 1;
    return 0;
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
            <div className={styles.name}>
              {c.name}
              {c.reviewed && <span className={styles.reviewedBadge}>Swiss-Prot</span>}
              <span className={styles.speciesTag}>{c.speciesLabel}</span>
            </div>
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
