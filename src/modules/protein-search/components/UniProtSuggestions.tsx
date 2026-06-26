import type { UniProtCandidate } from '../../shared/types';

interface UniProtSuggestionsProps {
  candidates: UniProtCandidate[];
  loading: boolean;
  onSelect: (candidate: UniProtCandidate) => void;
}

/**
 * UniProt 候选蛋白下拉列表
 * 按氨基酸长度降序排列
 */
export function UniProtSuggestions({
  candidates,
  loading,
  onSelect,
}: UniProtSuggestionsProps) {
  if (loading && candidates.length === 0) {
    return (
      <div
        style={{
          padding: '1rem',
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}
      >
        搜索中...
      </div>
    );
  }

  if (!loading && candidates.length === 0) {
    return null;
  }

  const sorted = [...candidates].sort((a, b) => b.length - a.length);

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        marginTop: '0.25rem',
      }}
    >
      {sorted.map((c) => (
        <button
          key={c.accession}
          onClick={() => onSelect(c)}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '1rem',
            width: '100%',
            padding: '0.75rem 1rem',
            border: 'none',
            borderBottom: '1px solid var(--color-border)',
            background: '#fff',
            cursor: 'pointer',
            textAlign: 'left',
            font: 'inherit',
          }}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = '#f3f4f6';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = '#fff';
          }}
        >
          <div>
            <div style={{ fontWeight: 600 }}>
              {c.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: '0.15rem' }}>
              {c.gene} · {c.organism}
            </div>
            {c.aliases.length > 0 && (
              <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.1rem' }}>
                别名: {c.aliases.join(', ')}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            <div style={{ fontFamily: 'monospace' }}>{c.accession}</div>
            <div style={{ marginTop: '0.15rem' }}>{c.length} aa</div>
          </div>
        </button>
      ))}
    </div>
  );
}
