import { useNavigate } from 'react-router-dom';
import type { PdbStructure, UniProtCandidate } from '../../shared/types';
import { LigandCell } from './LigandCell';
import { computeSortPriority } from '../utils/tableSortUtils';

/** 优先级标签 */
const PRIORITY_LABEL: Record<string, { text: string; emoji: string; color: string }> = {
  apo: { text: 'apo', emoji: '🟢', color: '#16a34a' },
  holo_cofactor: { text: '辅因子', emoji: '🔵', color: '#3b82f6' },
  inhibited: { text: '抑制剂', emoji: '🔴', color: '#ef4444' },
  unknown: { text: '未知', emoji: '⚪', color: '#6b7280' },
};

interface PdbResultTableProps {
  structures: PdbStructure[];
  selectedProtein: UniProtCandidate;
  loading: boolean;
  progress?: { done: number; total: number };
  onBeforeAnalyze?: () => void;
}

/**
 * PDB 结构结果表格（按配体纯度排序）
 * 列: 优先级 | PDB ID | 结构范围 | 文献 DOI | 配体 | 文献分析
 */
export function PdbResultTable({
  structures,
  selectedProtein,
  loading,
  progress,
  onBeforeAnalyze,
}: PdbResultTableProps) {
  const navigate = useNavigate();

  if (loading && structures.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        {progress
          ? `加载中... ${progress.done}/${progress.total}`
          : '加载中...'}
      </div>
    );
  }

  if (structures.length === 0) {
    return null;
  }

  const handleAnalyze = (doi: string, pdbId: string) => {
    onBeforeAnalyze?.();
    const params = new URLSearchParams({
      doi,
      pdb: pdbId,
      uniprot: selectedProtein.accession,
    });
    navigate(`/article-search?${params.toString()}`);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.9rem',
        }}
      >
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <Th style={{ width: 60 }}>纯度</Th>
            <Th>PDB ID</Th>
            <Th>结构范围</Th>
            <Th>文献</Th>
            <Th>配体</Th>
            <Th style={{ width: 80 }}>分析</Th>
          </tr>
        </thead>
        <tbody>
          {structures.map((s) => {
            const priority = computeSortPriority(s);
            const badge = PRIORITY_LABEL[priority];
            return (
              <tr
                key={s.pdbId}
                style={{ borderBottom: '1px solid var(--color-border)' }}
              >
                <Td>
                  <span
                    title={badge.text}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: badge.color,
                    }}
                  >
                    {badge.emoji}
                  </span>
                </Td>

                <Td>
                  <a
                    href={`https://www.rcsb.org/structure/${s.pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: 'var(--color-primary)',
                      textDecoration: 'none',
                      fontWeight: 600,
                      fontFamily: 'monospace',
                    }}
                  >
                    {s.pdbId}
                  </a>
                </Td>

                <Td>
                  <StructureRange coverage={s.coverage} resolution={s.resolution} />
                </Td>

                <Td>
                  {s.doi ? (
                    <a
                      href={`https://doi.org/${s.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: 'var(--color-primary)',
                        textDecoration: 'none',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                      }}
                    >
                      {s.doi}
                    </a>
                  ) : (
                    <span style={{ color: '#9ca3af' }}>-</span>
                  )}
                </Td>

                <Td>
                  <LigandCell ligands={s.ligands} />
                </Td>

                <Td>
                  {s.doi ? (
                    <button
                      onClick={() => handleAnalyze(s.doi!, s.pdbId)}
                      title="在文献分析模块中打开"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        padding: '4px 8px',
                      }}
                    >
                      📄
                    </button>
                  ) : (
                    <span style={{ color: '#d1d5db' }}>—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 表头单元格 */
function Th({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        padding: '0.6rem 0.75rem',
        textAlign: 'left',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

/** 表体单元格 */
function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: '0.5rem 0.75rem', verticalAlign: 'top' }}>
      {children}
    </td>
  );
}

/** 结构范围简要显示 */
function StructureRange({
  coverage,
  resolution,
}: {
  coverage: PdbStructure['coverage'];
  resolution: number | null;
}) {
  if (coverage.length === 0) {
    return <span style={{ color: '#9ca3af' }}>-</span>;
  }

  return (
    <div>
      {coverage.map((c, i) => (
        <div
          key={i}
          style={{ marginBottom: i < coverage.length - 1 ? '0.25rem' : 0 }}
        >
          <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>
            Chain {c.chainId}
          </span>
          <span
            style={{ color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}
          >
            {c.organism}
          </span>
          {c.features.length > 0 && (
            <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              {c.features.map((f) => `${f.name}:${f.start}-${f.end}`).join(', ')}
            </div>
          )}
        </div>
      ))}
      {resolution && (
        <div
          style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.15rem' }}
        >
          {resolution.toFixed(2)} Å
        </div>
      )}
    </div>
  );
}
