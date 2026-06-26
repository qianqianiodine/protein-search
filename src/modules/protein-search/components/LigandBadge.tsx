import type { LigandClass } from '../../shared/types';
import { LIGAND_COLORS } from '../../shared/types';

/** 配体分类中文标签 */
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

/**
 * 着色配体标签
 * 🔵 辅因子 | 🔴 抑制剂 | ⬜ 结晶/缓冲液 | 🟡 金属 | ⚪ 未知
 */
export function LigandBadge({ compId, name, classification }: LigandBadgeProps) {
  const color = LIGAND_COLORS[classification];
  const label = CLASS_LABELS[classification];

  return (
    <span
      title={`${compId}: ${name} (${label})`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '0.8rem',
        fontWeight: 500,
        fontFamily: 'monospace',
        color: '#fff',
        background: color,
        whiteSpace: 'nowrap',
      }}
    >
      {compId}
    </span>
  );
}
