import type { LigandSummary } from '../../shared/types';
import { LigandBadge } from './LigandBadge';

interface LigandCellProps {
  ligands: LigandSummary[];
}

/**
 * 配体列单元格 — 渲染着色的 LigandBadge 列表
 */
export function LigandCell({ ligands }: LigandCellProps) {
  if (ligands.length === 0) {
    return <span style={{ color: '#9ca3af' }}>-</span>;
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
      {ligands.map((l) => (
        <LigandBadge
          key={l.entityId}
          compId={l.compId}
          name={l.name}
          classification={l.classification}
        />
      ))}
    </div>
  );
}
