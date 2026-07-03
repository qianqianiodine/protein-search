import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { deleteArticleExtractionsByKeys } from '../../article-search/services/articleHistoryService';
import { loadSummary, saveSummary } from '../../article-search/services/summaryStorage';
import { clearPendingPdfs } from '../../article-search/services/pdfFileCache';
import type { UniProtCandidate, PdbStructure, SearchHistoryEntry } from '../../shared/types';

type Phase =
  | 'idle'
  | 'searching_uniprot'
  | 'suggestions'
  | 'loading_pdb'
  | 'results';

export function ProteinSearchPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('idle');
  const [candidates, setCandidates] = useState<UniProtCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [selectedProtein, setSelectedProtein] = useState<UniProtCandidate | null>(null);
  const [structures, setStructures] = useState<PdbStructure[]>([]);
  const [pdbProgress, setPdbProgress] = useState({ done: 0, total: 0 });
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const uniprotAbortRef = useRef<AbortController | null>(null);
  const pdbAbortRef = useRef<AbortController | null>(null);
  const searchCardRef = useRef<HTMLDivElement>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => { setHistory(loadHistory()); }, []);

  const _hasStaleCache = (results: PdbStructure[]) =>
    results.some((s) => s.doi && !s.citationTitle);

  useEffect(() => {
    const saved = restoreProteinSearchState();
    if (saved?.selectedProtein && saved.pdbResults.length > 0 && !_hasStaleCache(saved.pdbResults)) {
      isRestoringRef.current = true;
      setSelectedProtein(saved.selectedProtein);
      setStructures(saved.pdbResults);
      setPhase('results');
      // 滚动恢复推迟到第二个 effect（等 DOM 渲染完表格）
    }
  }, []);

  // 恢复场景：等 DOM 渲染完表格后再恢复滚动位置
  useEffect(() => {
    if (!isRestoringRef.current) return;
    if (phase !== 'results' || structures.length === 0) return;
    const saved = restoreProteinSearchState();
    if (saved?.scrollPosition) {
      restoreScrollPosition(saved.scrollPosition);
    }
    isRestoringRef.current = false;
  }, [phase, structures.length]);

  const handleSearch = useCallback(async (query: string, taxId: number) => {
    uniprotAbortRef.current?.abort();
    const controller = new AbortController();
    uniprotAbortRef.current = controller;
    setPhase('searching_uniprot');
    setCandidates([]);
    setError(null);
    setInfoMessage(null);
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

  const handleSelectProtein = useCallback(async (candidate: UniProtCandidate) => {
    pdbAbortRef.current?.abort();
    setSelectedProtein(candidate);
    setStructures([]);
    setInfoMessage(null);

    // 选中相同蛋白时走缓存快速恢复
    const freshHistory = loadHistory();
    const cached = freshHistory.find(
      (h) => h.protein.accession === candidate.accession && h.pdbResults.length > 0 && !_hasStaleCache(h.pdbResults),
    );
    if (cached) {
      const enriched: UniProtCandidate = { ...candidate, cofactors: cached.protein.cofactors || [] };
      setSelectedProtein(enriched);
      setStructures(cached.pdbResults);
      setPhase('results');
      return;
    }

    setPhase('loading_pdb');
    const pdbController = new AbortController();
    pdbAbortRef.current = pdbController;
    try {
      const [cofactors, pdbIds] = await Promise.all([
        getProteinDetail(candidate.accession, pdbController.signal).catch(() => [] as []),
        searchPdbByUniprot(candidate.accession, pdbController.signal).catch((err: unknown) => {
          if (err instanceof DOMException && err.name === 'AbortError') throw err;
          console.warn('PDB search failed:', err);
          return [] as string[];
        }),
      ]);
      if (pdbController.signal.aborted) return;
      const enriched: UniProtCandidate = { ...candidate, cofactors };
      setSelectedProtein(enriched);
      if (pdbIds.length === 0) {
        setInfoMessage('该蛋白暂无 X-ray PDB 结构');
        setPhase('results');
        return;
      }
      const structs = await getPdbStructures(
        pdbIds,
        (done, total) => setPdbProgress({ done, total }),
        pdbController.signal,
      );
      if (pdbController.signal.aborted) return;
      if (structs.length === 0) {
        setInfoMessage('该蛋白暂无 X-ray PDB 结构');
        setPhase('results');
        return;
      }
      const classified = structs.map((s) => classifyStructureLigands(s));
      const sorted = sortByPriority(classified);
      setStructures(sorted);
      setPhase('results');
    } catch {
      if (pdbController.signal.aborted) return;
      setError('PDB 数据获取失败');
      setPhase('results');
    }
  }, []);

  // 点击搜索卡片外部关闭下拉菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!searchCardRef.current) return;
      if (phase !== 'suggestions' && phase !== 'searching_uniprot') return;
      if (searchCardRef.current.contains(e.target as Node)) return;
      setCandidates([]);
      setPhase(selectedProtein ? 'results' : 'idle');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [phase, selectedProtein]);

  // Auto-save history on search complete
  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (prevPhaseRef.current === 'loading_pdb' && phase === 'results' && selectedProtein && structures.length > 0) {
      saveHistory({
        id: generateId(),
        timestamp: Date.now(),
        query: selectedProtein.gene || selectedProtein.accession,
        taxId: selectedProtein.taxId,
        protein: { accession: selectedProtein.accession, name: selectedProtein.name, gene: selectedProtein.gene, aliases: selectedProtein.aliases, organism: selectedProtein.organism, length: selectedProtein.length, reviewed: selectedProtein.reviewed, speciesLabel: selectedProtein.speciesLabel, subcellularLocation: selectedProtein.subcellularLocation },
        pdbResults: structures,
        sortState: {},
        filterState: {},
        scrollPosition: 0,
      });
      setHistory(loadHistory());
      // 保存状态以支持页面刷新恢复
      saveProteinSearchState({
        query: selectedProtein.gene || selectedProtein.accession,
        taxId: selectedProtein.taxId,
        selectedProtein,
        pdbResults: structures,
        sortState: {},
        filterState: {},
        scrollPosition: 0,
      });
    }
    prevPhaseRef.current = phase;
  }, [phase, selectedProtein, structures]);

  const handleRestore = useCallback((entry: SearchHistoryEntry) => {
    pdbAbortRef.current?.abort();
    const protein = { accession: entry.protein.accession, uniProtId: entry.protein.accession, name: entry.protein.name, gene: entry.protein.gene, aliases: entry.protein.aliases, organism: entry.protein.organism, taxId: entry.taxId, length: entry.protein.length, cofactors: [], reviewed: entry.protein.reviewed, speciesLabel: entry.protein.speciesLabel, subcellularLocation: entry.protein.subcellularLocation };
    setSelectedProtein(protein);
    setStructures(entry.pdbResults);
    setPhase('results');
    setHistoryOpen(false);
    saveProteinSearchState({
      query: entry.query,
      taxId: entry.taxId,
      selectedProtein: protein,
      pdbResults: entry.pdbResults,
      sortState: entry.sortState,
      filterState: entry.filterState,
      scrollPosition: 0,
    });
  }, []);

  const handleDelete = useCallback((id: string) => {
    // 找到要删除的历史条目，联动删除其关联缓存
    const entry = history.find((h) => h.id === id);
    if (entry) {
      // 收集该条目中所有唯一的 (doi, uniprot) 对
      const pairs: Array<{ doi: string; uniprot: string }> = [];
      const seen = new Set<string>();
      for (const pdb of entry.pdbResults) {
        if (pdb.doi) {
          const key = `${pdb.doi}|${entry.protein.accession}`;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push({ doi: pdb.doi, uniprot: entry.protein.accession });
          }
        }
      }
      // 联动删除：文献提取缓存 + 汇总条目
      if (pairs.length > 0) {
        deleteArticleExtractionsByKeys(pairs);
        const summary = loadSummary();
        const dropKeys = new Set(pairs.map((p) => `${p.doi}|${p.uniprot}`));
        saveSummary(summary.filter((s) => !dropKeys.has(`${s.doi}|${s.uniprot}`)));
      }
      // 清除 PDF 文件缓存
      clearPendingPdfs();
    }
    // 删除搜索历史本身
    deleteHistory(id);
    setHistory(loadHistory());
  }, [history]);

  const handleBeforeAnalyze = useCallback(() => {
    if (selectedProtein) {
      saveProteinSearchState({ query: selectedProtein.gene || selectedProtein.accession, taxId: selectedProtein.taxId, selectedProtein, pdbResults: structures, sortState: {}, filterState: {}, scrollPosition: window.scrollY });
    }
  }, [selectedProtein, structures]);

  // --- layout styles ---
  const page = { maxWidth: 1300, margin: '0 auto', padding: 'var(--space-2xl)' };
  const card = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)' };
  const mb = { marginBottom: 'var(--space-xl)' };
  const headerRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2xl)' };
  const proteinBar = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg) var(--space-xl)', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap' as const };
  const histBtn = { padding: 'var(--space-sm) var(--space-lg)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--color-text)', whiteSpace: 'nowrap' as const, fontWeight: 'var(--weight-medium)' as const };
  const errBox = { marginTop: 'var(--space-md)', padding: 'var(--space-md)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' };

  return (
    <div style={page}>
      <header style={headerRow}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
            Protein Structure Search
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
            检索 UniProt 蛋白，查看 RCSB PDB 晶体结构，识别配体类型
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            style={histBtn}
            onClick={() => {
              if (selectedProtein) {
                navigate(`/article-summary?uniprot=${encodeURIComponent(selectedProtein.accession)}&gene=${encodeURIComponent(selectedProtein.gene)}`);
              } else {
                navigate('/article-summary');
              }
            }}
          >
            📊 汇总对比
          </button>
          <button style={histBtn} onClick={() => { setHistory(loadHistory()); setHistoryOpen(true); }}>
            📋 历史 ({history.length})
          </button>
        </div>
      </header>

      <div ref={searchCardRef} style={{ ...card, ...mb }}>
        <SearchBar onSearch={handleSearch} disabled={phase === 'loading_pdb'} />
        {(phase === 'searching_uniprot' || phase === 'suggestions') && (
          <UniProtSuggestions candidates={candidates} loading={phase === 'searching_uniprot'} onSelect={handleSelectProtein} />
        )}
        {error && <div style={errBox}>{error}</div>}
      </div>

      {selectedProtein && (
        <div style={proteinBar}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{selectedProtein.gene}</span>
            <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
              ({selectedProtein.name})
            </span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 500 }}>
            {selectedProtein.accession}
          </span>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            {selectedProtein.organism} · {selectedProtein.length} aa
          </span>
          {selectedProtein.cofactors.length > 0 && (
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-primary)' }}>
             辅因子: {selectedProtein.cofactors.map((c) => c.name).join(', ')}
            </span>
          )}
        </div>
      )}

      {selectedProtein && (
        <div style={card}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-lg)', display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)' }}>
            PDB 结构 ({structures.length})
            {pdbProgress.total > 0 && pdbProgress.done < pdbProgress.total && (
              <span style={{ fontWeight: 400, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                加载中 {pdbProgress.done}/{pdbProgress.total}
              </span>
            )}
          </h2>
          {structures.length === 0 && infoMessage && phase !== 'loading_pdb' && (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 'var(--text-base)' }}>
              {infoMessage}
            </div>
          )}
          <PdbResultTable structures={structures} selectedProtein={selectedProtein} loading={phase === 'loading_pdb'} progress={pdbProgress} onBeforeAnalyze={handleBeforeAnalyze} />
        </div>
      )}

      <HistoryDrawer open={historyOpen} history={history} onClose={() => setHistoryOpen(false)} onRestore={handleRestore} onDelete={handleDelete} />
    </div>
  );
}
