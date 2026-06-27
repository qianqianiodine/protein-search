import { useEffect, useState } from 'react';

interface AnnotationToolbarProps {
  onBold: () => void;
  onHighlight: () => void;
}

export function AnnotationToolbar({ onBold, onHighlight }: AnnotationToolbarProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    };

    document.addEventListener('selectionchange', handler);
    document.addEventListener('mouseup', handler);
    return () => {
      document.removeEventListener('selectionchange', handler);
      document.removeEventListener('mouseup', handler);
    };
  }, []);

  if (!pos) return null;

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--color-surface)',
    cursor: 'pointer',
    color: 'var(--color-text)',
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, -100%)',
        display: 'flex',
        gap: 'var(--space-xs)',
        padding: 'var(--space-xs)',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
      }}
    >
      <button style={{ ...btnStyle, fontWeight: 700 }} onClick={onBold} title="加粗">
        B
      </button>
      <button
        style={{ ...btnStyle, background: '#FFF3B0' }}
        onClick={onHighlight}
        title="高亮"
      >
        H
      </button>
    </div>
  );
}
