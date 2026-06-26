import type { SearchHistoryEntry } from '../../shared/types';

interface HistoryItemProps {
  entry: SearchHistoryEntry;
  onRestore: (entry: SearchHistoryEntry) => void;
  onDelete: (id: string) => void;
}

/**
 * 单条搜索历史
 * 显示蛋白名称、accession、物种、PDB 数量
 */
export function HistoryItem({ entry, onRestore, onDelete }: HistoryItemProps) {
  const date = new Date(entry.timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onRestore(entry)}
      style={{
        padding: '0.75rem',
        borderBottom: '1px solid var(--color-border)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = '#f3f4f6';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = '#fff';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
            {entry.protein.name}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
            <span style={{ fontFamily: 'monospace' }}>{entry.protein.accession}</span>
            <span style={{ margin: '0 0.4rem' }}>·</span>
            <span>{entry.protein.gene}</span>
          </div>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.1rem' }}>
            {entry.protein.organism} · {entry.protein.length} aa
            {' · '}
            {entry.pdbResults.length} 个 PDB
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
            {date}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm('确定要删除这条搜索历史吗？')) {
                onDelete(entry.id);
              }
            }}
            title="删除"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              color: '#9ca3af',
              padding: '2px',
              lineHeight: 1,
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </div>
  );
}
