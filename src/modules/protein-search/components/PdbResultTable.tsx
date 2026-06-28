import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PdbStructure, UniProtCandidate } from '../../shared/types';
import { LigandCell } from './LigandCell';
import { computeSortPriority } from '../utils/tableSortUtils';
import styles from './PdbResultTable.module.css';

const PRIORITY_LABEL: Record<string, { text: string; dotClass: string }> = {
  apo: { text: 'Apo', dotClass: styles.dotApo },
  holo_cofactor: { text: '辅因子', dotClass: styles.dotCofactor },
  inhibited: { text: '抑制剂', dotClass: styles.dotInhibitor },
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
  const [hoveredGroup, setHoveredGroup] = useState<number | null>(null);

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

  // 计算 DOI 分组合并信息
  const doiGroups = buildDoiGroups(structures);

  const handleAnalyze = (doi: string, pdbIds: string[], citationTitle?: string | null) => {
    onBeforeAnalyze?.();
    const params = new URLSearchParams({ doi, pdb: pdbIds.join(','), uniprot: selectedProtein.accession, proteinName: selectedProtein.name, gene: selectedProtein.gene });
    if (citationTitle) {
      params.set('title', citationTitle);
    }
    navigate(`/article-search?${params.toString()}`);
  };

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead className={styles.thead}>
          <tr>
            <th className={styles.th} style={{ width: 80 }}>类型</th>
            <th className={styles.th}>PDB ID</th>
            <th className={styles.th}>结构范围</th>
            <th className={styles.th}>文献</th>
            <th className={styles.th}>配体</th>
            <th className={`${styles.th} ${styles.thLast}`} style={{ width: 60 }}>分析</th>
          </tr>
        </thead>
        <tbody className={styles.tbody}>
          {structures.map((s, idx) => {
            const priority = computeSortPriority(s);
            const badge = PRIORITY_LABEL[priority];
            const dg = doiGroups[idx];
            return (
              <tr
                key={s.pdbId}
                className={hoveredGroup === dg.groupId ? styles.rowHovered : undefined}
                onMouseEnter={() => setHoveredGroup(dg.groupId)}
                onMouseLeave={() => setHoveredGroup(null)}
              >
                <td className={`${styles.td} ${styles.priorityCell}`}>
                  <span className={styles.priorityBadge} title={badge.text}>
                    <span className={`${styles.dot} ${badge.dotClass}`} />
                    <span className={styles.priorityText}>{badge.text}</span>
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
                      {c.uniprotStart != null && c.uniprotEnd != null && (
                        <div className={styles.residueRange}>
                          aa {c.uniprotStart}-{c.uniprotEnd}
                        </div>
                      )}
                    </div>
                  ))}
                  {s.resolution && (
                    <div className={styles.resolution}>{s.resolution.toFixed(2)} Å</div>
                  )}
                </td>
                {/* DOI 列 — 仅首行渲染，带 rowSpan 合并 */}
                {dg.showDoi && (
                  <td className={`${styles.td} ${styles.doiCell}`} rowSpan={dg.rowSpan}>
                    {s.doi ? (
                      <>
                        <a
                          className={styles.doiLink}
                          href={`https://doi.org/${s.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {s.doi}
                        </a>
                        {s.citationTitle && (
                          <div className={styles.citationTitle}>{s.citationTitle}</div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>-</span>
                    )}
                  </td>
                )}
                <td className={styles.td}>
                  <LigandCell ligands={s.ligands} />
                </td>
                {/* 分析列 — 首行带 rowSpan 合并 */}
                {dg.showDoi && (
                  <td className={`${styles.td} ${styles.tdLast} ${styles.analyzeCell}`} rowSpan={dg.rowSpan}>
                    {s.doi ? (
                      <button
                        className={styles.analyzeBtn}
                        onClick={() => {
                          const groupPdbIds = structures.slice(idx, idx + dg.rowSpan).map((r) => r.pdbId);
                          handleAnalyze(s.doi!, groupPdbIds, s.citationTitle);
                        }}
                        title="在文献分析模块中打开"
                      >
                        📄
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** 计算 DOI 列 rowspan 合并信息 */
function buildDoiGroups(structures: PdbStructure[]): Array<{ showDoi: boolean; rowSpan: number; groupId: number }> {
  const groups: Array<{ showDoi: boolean; rowSpan: number; groupId: number }> = [];
  let i = 0;
  let groupCounter = 0;
  while (i < structures.length) {
    const doi = structures[i].doi;
    if (!doi) {
      // 无 DOI — 每行独立组
      groups.push({ showDoi: true, rowSpan: 1, groupId: groupCounter++ });
      i++;
      continue;
    }
    // 统计连续相同 DOI 的行数
    let count = 1;
    while (i + count < structures.length && structures[i + count].doi === doi) {
      count++;
    }
    const gid = groupCounter++;
    groups.push({ showDoi: true, rowSpan: count, groupId: gid });
    for (let j = 1; j < count; j++) {
      groups.push({ showDoi: false, rowSpan: 0, groupId: gid });
    }
    i += count;
  }
  return groups;
}
