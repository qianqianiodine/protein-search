import { useNavigate } from 'react-router-dom';
import type { PdbStructure, UniProtCandidate } from '../../shared/types';
import { LigandCell } from './LigandCell';
import { computeSortPriority } from '../utils/tableSortUtils';
import styles from './PdbResultTable.module.css';

const PRIORITY_LABEL: Record<string, { text: string; emoji: string }> = {
  apo: { text: 'apo', emoji: '🟢' },
  holo_cofactor: { text: '辅因子', emoji: '🔵' },
  inhibited: { text: '抑制剂', emoji: '🔴' },
  unknown: { text: '未知', emoji: '⚪' },
};

interface PdbResultTableProps {
  structures: PdbStructure[];
  selectedProtein: UniProtCandidate;
  loading: boolean;
  progress?: { done: number; total: number };
  onBeforeAnalyze?: () => void;
}

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
      <div className={styles.loading}>
        {progress
          ? `加载中... ${progress.done}/${progress.total}`
          : '加载中...'}
      </div>
    );
  }

  if (structures.length === 0) return null;

  const handleAnalyze = (doi: string, pdbId: string) => {
    onBeforeAnalyze?.();
    const params = new URLSearchParams({ doi, pdb: pdbId, uniprot: selectedProtein.accession });
    navigate(`/article-search?${params.toString()}`);
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th} style={{ width: 52 }}>#</th>
            <th className={styles.th}>PDB ID</th>
            <th className={styles.th}>结构范围</th>
            <th className={styles.th}>文献</th>
            <th className={styles.th}>配体</th>
            <th className={styles.th} style={{ width: 60 }}>分析</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {structures.map((s) => {
            const priority = computeSortPriority(s);
            const badge = PRIORITY_LABEL[priority];
            return (
              <tr key={s.pdbId}>
                <td className={styles.td}>
                  <span className={styles.priorityBadge} title={badge.text}>
                    {badge.emoji}
                  </span>
                </td>
                <td className={styles.td}>
                  <a
                    className={styles.pdbLink}
                    href={`https://www.rcsb.org/structure/${s.pdbId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.pdbId}
                  </a>
                </td>
                <td className={styles.td}>
                  {s.coverage.map((c, i) => (
                    <div key={i} className={styles.structMeta}>
                      <span className={styles.chainLabel}>Chain {c.chainId}</span>
                      <span className={styles.orgName}>{c.organism}</span>
                      {c.features.length > 0 && (
                        <div className={styles.features}>
                          {c.features.map((f) => `${f.name}:${f.start}-${f.end}`).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                  {s.resolution && (
                    <div className={styles.resolution}>{s.resolution.toFixed(2)} Å</div>
                  )}
                </td>
                <td className={styles.td}>
                  {s.doi ? (
                    <a
                      className={styles.doiLink}
                      href={`https://doi.org/${s.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {s.doi}
                    </a>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                  )}
                </td>
                <td className={styles.td}>
                  <LigandCell ligands={s.ligands} />
                </td>
                <td className={styles.td}>
                  {s.doi ? (
                    <button
                      className={styles.analyzeBtn}
                      onClick={() => handleAnalyze(s.doi!, s.pdbId)}
                      title="在文献分析模块中打开"
                    >
                      📄
                    </button>
                  ) : (
                    <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
