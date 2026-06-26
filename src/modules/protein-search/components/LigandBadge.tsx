import type { LigandClass } from '../../shared/types';
import { LIGAND_COLORS } from '../../shared/types';
import styles from './LigandBadge.module.css';

const CLASS_LABELS: Record<LigandClass, string> = {
  cofactor: '辅因子',
  inhibitor: '抑制剂',
  crystal: '结晶',
  metal: '金属',
  unknown: '未知',
};

interface LigandBadgeProps {
  compId: string;
  name: string;
  classification: LigandClass;
}

export function LigandBadge({ compId, name, classification }: LigandBadgeProps) {
  const color = LIGAND_COLORS[classification];
  const label = CLASS_LABELS[classification];

  return (
    <span
      className={styles.badge}
      title={`${compId}: ${name}`}
      style={{ background: color }}
    >
      {compId}
      <span className={styles.label}>{label}</span>
    </span>
  );
}
