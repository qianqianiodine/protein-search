import { HistoryItem } from './HistoryItem';
import type { SearchHistoryEntry } from '../../shared/types';

interface HistoryDrawerProps {
  open: boolean;
  history: SearchHistoryEntry[];
  onClose: () => void;
  onRestore: (entry: SearchHistoryEntry) => void;
  onDelete: (id: string) => void;
}

/**
 * 搜索历史侧边栏抽屉
 */
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
      {/* 遮罩层 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 100,
        }}
      />

      {/* 抽屉 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          maxWidth: '90vw',
          background: '#fff',
          boxShadow: '-4px 0 16px rgba(0,0,0,0.12)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
            搜索历史
            {history.length > 0 && (
              <span style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>
                ({history.length})
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.3rem',
              color: '#9ca3af',
              padding: '4px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* 内容 */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div
              style={{
                padding: '2rem',
                textAlign: 'center',
                color: 'var(--color-text-secondary)',
              }}
            >
              暂无搜索历史
            </div>
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
