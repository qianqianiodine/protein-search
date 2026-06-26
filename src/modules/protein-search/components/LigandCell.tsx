import type { LigandSummary } from '../../shared/types';
import { LigandBadge } from './LigandBadge';
import styles from './LigandCell.module.css';

interface LigandCellProps {
  ligands: LigandSummary[];
}

export function LigandCell({ ligands }: LigandCellProps) {
  if (ligands.length === 0) {
    return <span className={styles.empty}>-</span>;
  }

  return (
    <div className={styles.cell}>
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
