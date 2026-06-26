import { useCallback, useRef, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { UniProtSuggestions } from '../components/UniProtSuggestions';
import { PdbResultTable } from '../components/PdbResultTable';
import { searchProteins, getProteinDetail } from '../services/uniprotService';
import { searchPdbByUniprot, getPdbStructures } from '../services/rcsbService';
import type { UniProtCandidate, PdbStructure } from '../../shared/types';

/** 搜索阶段 */
type Phase =
  | 'idle'
  | 'searching_uniprot'
  | 'suggestions'
  | 'loading_pdb'
  | 'results';

export function ProteinSearchPage() {
  // UniProt 搜索状态
  const [phase, setPhase] = useState<Phase>('idle');
  const [candidates, setCandidates] = useState<UniProtCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 选中的蛋白
  const [selectedProtein, setSelectedProtein] = useState<UniProtCandidate | null>(null);

  // PDB 结果
  const [structures, setStructures] = useState<PdbStructure[]>([]);
  const [pdbProgress, setPdbProgress] = useState({ done: 0, total: 0 });

  // 取消控制器
  const uniprotAbortRef = useRef<AbortController | null>(null);
  const pdbAbortRef = useRef<AbortController | null>(null);

  /** 搜索 UniProt */
  const handleSearch = useCallback(async (query: string, taxId: number) => {
    // 取消之前的 UniProt 请求
    uniprotAbortRef.current?.abort();
    const controller = new AbortController();
    uniprotAbortRef.current = controller;

    setPhase('searching_uniprot');
    setCandidates([]);
    setError(null);

    try {
      const results = await searchProteins(query, taxId, controller.signal);
      if (controller.signal.aborted) return;
      setCandidates(results);
      setPhase('suggestions');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError('UniProt 搜索失败，请检查网络后重试');
      setPhase('idle');
    }
  }, []);

  /** 选择候选蛋白 → 获取辅因子 + 搜索 PDB */
  const handleSelectProtein = useCallback(async (candidate: UniProtCandidate) => {
    // 取消之前的 PDB 请求
    pdbAbortRef.current?.abort();

    setSelectedProtein(candidate);
    setStructures([]);
    setPhase('loading_pdb');

    const pdbController = new AbortController();
    pdbAbortRef.current = pdbController;

    try {
      // 并行: 获取辅因子 + 搜索 PDB
      const [cofactors, pdbIds] = await Promise.all([
        getProteinDetail(candidate.accession, pdbController.signal).catch(() => [] as []),
        searchPdbByUniprot(candidate.accession, pdbController.signal),
      ]);

      if (pdbController.signal.aborted) return;

      // 更新 candidate 的 cofactor 信息
      setSelectedProtein((prev) => prev ? { ...prev, cofactors } : null);

      if (pdbIds.length === 0) {
        setPhase('results');
        return;
      }

      // 逐个获取 PDB 结构详情（带进度）
      const structs = await getPdbStructures(
        pdbIds,
        (done, total) => setPdbProgress({ done, total }),
        pdbController.signal,
      );

      if (pdbController.signal.aborted) return;
      setStructures(structs);
      setPhase('results');
    } catch (err) {
      if (pdbController.signal.aborted) return;
      setError('PDB 数据获取失败');
      setPhase('results');
    }
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
          Protein Structure Search
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
          检索 UniProt 蛋白，查看 RCSB PDB 晶体结构，识别配体类型
        </p>
      </header>

      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <SearchBar
          onSearch={handleSearch}
          disabled={phase === 'loading_pdb'}
        />

        {(phase === 'searching_uniprot' || phase === 'suggestions') && (
          <UniProtSuggestions
            candidates={candidates}
            loading={phase === 'searching_uniprot'}
            onSelect={handleSelectProtein}
          />
        )}

        {error && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.75rem',
            color: '#dc2626',
            background: '#fef2f2',
            borderRadius: '6px',
            fontSize: '0.9rem',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* 当前选中蛋白的信息 */}
      {selectedProtein && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <div>
            <span style={{ fontWeight: 600 }}>{selectedProtein.name}</span>
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>
              ({selectedProtein.gene})
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-primary)' }}>
            {selectedProtein.accession}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
            {selectedProtein.organism} · {selectedProtein.length} aa
          </div>
          {selectedProtein.cofactors.length > 0 && (
            <div style={{ fontSize: '0.85rem', color: '#3b82f6' }}>
              辅因子: {selectedProtein.cofactors.map((c) => c.name).join(', ')}
            </div>
          )}
        </div>
      )}

      {/* PDB 结果表格 */}
      {selectedProtein && (
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '1.5rem',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            PDB 结构 ({structures.length})
            {pdbProgress.total > 0 && pdbProgress.done < pdbProgress.total && (
              <span style={{ fontWeight: 400, fontSize: '0.9rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>
                加载中 {pdbProgress.done}/{pdbProgress.total}
              </span>
            )}
          </h2>
          <PdbResultTable
            structures={structures}
            selectedProtein={selectedProtein}
            loading={phase === 'loading_pdb'}
            progress={pdbProgress}
          />
        </div>
      )}
    </div>
  );
}
