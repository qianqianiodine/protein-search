import { useCallback, useEffect, useRef, useState } from 'react';
import { SearchBar } from '../components/SearchBar';
import { UniProtSuggestions } from '../components/UniProtSuggestions';
import { PdbResultTable } from '../components/PdbResultTable';
import { HistoryDrawer } from '../components/HistoryDrawer';
import { searchProteins, getProteinDetail } from '../services/uniprotService';
import { searchPdbByUniprot, getPdbStructures } from '../services/rcsbService';
import { classifyStructureLigands, sortByPriority } from '../utils/tableSortUtils';
import {
  loadHistory,
  saveHistory,
  deleteHistory,
  generateId,
} from '../services/searchHistoryService';
import {
  saveProteinSearchState,
  restoreProteinSearchState,
  restoreScrollPosition,
} from '../services/statePreservationService';
import type { UniProtCandidate, PdbStructure, SearchHistoryEntry } from '../../shared/types';

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

  // 搜索历史
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  // 取消控制器
  const uniprotAbortRef = useRef<AbortController | null>(null);
  const pdbAbortRef = useRef<AbortController | null>(null);

  // 初始化加载历史
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // 从 article-search 返回时恢复状态
  useEffect(() => {
    const saved = restoreProteinSearchState();
    if (saved?.selectedProtein && saved.pdbResults.length > 0) {
      setSelectedProtein(saved.selectedProtein);
      setStructures(saved.pdbResults);
      setPhase('results');
      restoreScrollPosition(saved.scrollPosition);
    }
  }, []);

  /** 搜索 UniProt */
  const handleSearch = useCallback(async (query: string, taxId: number) => {
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
    } catch {
      if (controller.signal.aborted) return;
      setError('UniProt 搜索失败，请检查网络后重试');
      setPhase('idle');
    }
  }, []);

  /** 选择候选蛋白 → 获取辅因子 + 搜索 PDB */
  const handleSelectProtein = useCallback(async (candidate: UniProtCandidate) => {
    pdbAbortRef.current?.abort();
    setSelectedProtein(candidate);
    setStructures([]);
    setPhase('loading_pdb');

    const pdbController = new AbortController();
    pdbAbortRef.current = pdbController;

    try {
      const [cofactors, pdbIds] = await Promise.all([
        getProteinDetail(candidate.accession, pdbController.signal).catch(() => [] as []),
        searchPdbByUniprot(candidate.accession, pdbController.signal),
      ]);

      if (pdbController.signal.aborted) return;

      const enriched: UniProtCandidate = { ...candidate, cofactors };
      setSelectedProtein(enriched);

      if (pdbIds.length === 0) {
        setPhase('results');
        return;
      }

      const structs = await getPdbStructures(
        pdbIds,
        (done, total) => setPdbProgress({ done, total }),
        pdbController.signal,
      );

      if (pdbController.signal.aborted) return;

      // 配体分类 + 排序
      const classified = structs.map((s) => classifyStructureLigands(s, cofactors));
      const sorted = sortByPriority(classified);
      setStructures(sorted);
      setPhase('results');
    } catch {
      if (pdbController.signal.aborted) return;
      setError('PDB 数据获取失败');
      setPhase('results');
    }
  }, []);

  // 搜索完成后自动保存历史
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (
      prevPhaseRef.current === 'loading_pdb' &&
      phase === 'results' &&
      selectedProtein &&
      structures.length > 0
    ) {
      saveHistory({
        id: generateId(),
        timestamp: Date.now(),
        query: selectedProtein.gene || selectedProtein.accession,
        taxId: selectedProtein.taxId,
        protein: {
          accession: selectedProtein.accession,
          name: selectedProtein.name,
          gene: selectedProtein.gene,
          aliases: selectedProtein.aliases,
          organism: selectedProtein.organism,
          length: selectedProtein.length,
        },
        pdbResults: structures,
        sortState: {},
        filterState: {},
        scrollPosition: 0,
      });
      setHistory(loadHistory());
    }
    prevPhaseRef.current = phase;
  }, [phase, selectedProtein, structures]);

  /** 从历史恢复 */
  const handleRestore = useCallback((entry: SearchHistoryEntry) => {
    pdbAbortRef.current?.abort();
    setSelectedProtein({
      accession: entry.protein.accession,
      uniProtId: entry.protein.accession,
      name: entry.protein.name,
      gene: entry.protein.gene,
      aliases: entry.protein.aliases,
      organism: entry.protein.organism,
      taxId: entry.taxId,
      length: entry.protein.length,
      cofactors: [],
    });
    setStructures(entry.pdbResults);
    setPhase('results');
    setHistoryOpen(false);
  }, []);

  /** 删除历史 */
  const handleDelete = useCallback((id: string) => {
    deleteHistory(id);
    setHistory(loadHistory());
  }, []);

  /** 跳转 article-search 前保存当前状态 */
  const handleBeforeAnalyze = useCallback(() => {
    if (selectedProtein) {
      saveProteinSearchState({
        query: selectedProtein.gene || selectedProtein.accession,
        taxId: selectedProtein.taxId,
        selectedProtein,
        pdbResults: structures,
        sortState: {},
        filterState: {},
        scrollPosition: window.scrollY,
      });
    }
  }, [selectedProtein, structures]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text)' }}>
            Protein Structure Search
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
            检索 UniProt 蛋白，查看 RCSB PDB 晶体结构，识别配体类型
          </p>
        </div>
        <button
          onClick={() => {
            setHistory(loadHistory());
            setHistoryOpen(true);
          }}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
          }}
        >
          📋 历史 ({history.length})
        </button>
      </header>

      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <SearchBar onSearch={handleSearch} disabled={phase === 'loading_pdb'} />

        {(phase === 'searching_uniprot' || phase === 'suggestions') && (
          <UniProtSuggestions
            candidates={candidates}
            loading={phase === 'searching_uniprot'}
            onSelect={handleSelectProtein}
          />
        )}

        {error && (
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              color: '#dc2626',
              background: '#fef2f2',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* 当前选中蛋白的信息 */}
      {selectedProtein && (
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
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
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '1.5rem',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>
            PDB 结构 ({structures.length})
            {pdbProgress.total > 0 && pdbProgress.done < pdbProgress.total && (
              <span
                style={{
                  fontWeight: 400,
                  fontSize: '0.9rem',
                  color: 'var(--color-text-secondary)',
                  marginLeft: '0.5rem',
                }}
              >
                加载中 {pdbProgress.done}/{pdbProgress.total}
              </span>
            )}
          </h2>
          <PdbResultTable
            structures={structures}
            selectedProtein={selectedProtein}
            loading={phase === 'loading_pdb'}
            progress={pdbProgress}
            onBeforeAnalyze={handleBeforeAnalyze}
          />
        </div>
      )}

      {/* 搜索历史抽屉 */}
      <HistoryDrawer
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestore}
        onDelete={handleDelete}
      />
    </div>
  );
}
