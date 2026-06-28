import type { SearchHistoryEntry } from '../../shared/types';
import styles from './HistoryItem.module.css';

interface HistoryItemProps {
  entry: SearchHistoryEntry;
  onRestore: (entry: SearchHistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryItem({ entry, onRestore, onDelete }: HistoryItemProps) {
  const date = new Date(entry.timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={styles.item} onClick={() => onRestore(entry)}>
      <div className={styles.row}>
        <div className={styles.content}>
          <div className={styles.proteinName}>{entry.protein.name}</div>
          <div className={styles.meta}>
            <span className={styles.metaMono}>{entry.protein.accession}</span>
            <span className={styles.metaSep}>·</span>
            <span>{entry.protein.gene}</span>
          </div>
          <div className={styles.detail}>
            {entry.protein.organism} · {entry.protein.length} aa
            {' · '}
            {entry.pdbResults.length} 个 PDB
          </div>
        </div>
        <div className={styles.right}>
          <span className={styles.date}>{date}</span>
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('确定要删除这条搜索历史吗？')) {
                onDelete(entry.id);
              }
            }}
            title="删除"
            aria-label="删除"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
