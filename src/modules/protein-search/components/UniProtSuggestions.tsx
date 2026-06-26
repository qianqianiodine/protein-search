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

  const sorted = [...candidates].sort((a, b) => b.length - a.length);

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
