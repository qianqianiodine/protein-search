import { HistoryItem } from './HistoryItem';
import type { SearchHistoryEntry } from '../../shared/types';
import styles from './HistoryDrawer.module.css';

interface HistoryDrawerProps {
  open: boolean;
  history: SearchHistoryEntry[];
  onClose: () => void;
  onRestore: (entry: SearchHistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function HistoryDrawer({
  open,
  history,
  onClose,
  onRestore,
  onDelete,
}: HistoryDrawerProps) {
  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.drawer}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            搜索历史
            {history.length > 0 && (
              <span className={styles.count}>({history.length})</span>
            )}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.body}>
          {history.length === 0 ? (
            <div className={styles.empty}>暂无搜索历史</div>
          ) : (
            history.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
