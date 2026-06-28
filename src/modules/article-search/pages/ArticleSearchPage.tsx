import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { taskController } from '../services/articleSearchTaskController';
import { extractPdf } from '../services/extractionService';
import { clearPendingPdfs } from '../services/pdfFileCache';
import { addToSummary, isInSummary } from '../services/summaryStorage';
import {
  loadArticleExtraction,
  saveArticleExtraction,
} from '../services/articleHistoryService';
import { PdfUploader } from '../components/PdfUploader';
import { ExtractionResult } from '../components/ExtractionResult';
import type { ArticleExtraction } from '../../shared/types';

type Phase = 'idle' | 'extracting' | 'done';

export function ArticleSearchPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const doi = searchParams.get('doi') || '';
  const pdbRaw = searchParams.get('pdb') || '';
  const pdb = pdbRaw; // 保持原始字符串用于存储（可能逗号分隔多个 ID）
  const pdbIds = pdbRaw ? pdbRaw.split(',').filter(Boolean) : [];
  const uniprot = searchParams.get('uniprot') || '';
  const proteinName = searchParams.get('proteinName') || '';
  const paperTitle = searchParams.get('title') || '';

  // 页面加载时检查缓存
  const cached = doi && uniprot ? loadArticleExtraction(doi, uniprot) : null;
  const [phase, setPhase] = useState<Phase>(cached ? 'done' : 'idle');
  const [extraction, setExtraction] = useState<ArticleExtraction | null>(
    cached?.extraction || null,
  );
  const [extractedFromCache, setExtractedFromCache] = useState(!!cached);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(() => isInSummary(doi, uniprot));
  const abortRef = useRef<AbortController | null>(null);

  // 提取完成后自动存入历史
  useEffect(() => {
    if (phase === 'done' && extraction && doi && uniprot && !extractedFromCache) {
      saveArticleExtraction({
        id: `${doi}-${uniprot}-${Date.now()}`,
        doi,
        pdbId: pdb,
        uniprot,
        proteinName,
        title: doi || pdb || uniprot,
        extraction,
        timestamp: Date.now(),
      });
      setExtractedFromCache(false);
    }
  }, [phase, extraction, doi, pdb, uniprot, extractedFromCache]);

  const handleUpload = useCallback(
    async (mainPdf: File, suppPdf?: File | null) => {
      abortRef.current?.abort();
      const controller = taskController.register();
      abortRef.current = controller;

      setPhase('extracting');
      setError(null);
      setExtractedFromCache(false);
      try {
        const result = await extractPdf(mainPdf, suppPdf, controller.signal, { doi, pdb, uniprot });
        if (controller.signal.aborted) return;
        setExtraction(result);
        setPhase('done');
        setAdded(isInSummary(doi, uniprot));
        clearPendingPdfs(); // 提取成功后删除缓存的 PDF
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : '提取失败');
        setPhase('idle');
      } finally {
        taskController.remove(controller);
      }
    },
    [doi, uniprot],
  );

  const handleAddToSummary = () => {
    if (!extraction) return;
    addToSummary({
      id: `${doi}-${uniprot}-${Date.now()}`,
      doi,
      pdbId: pdb,
      uniprot,
      proteinName,
      title: doi || pdb || uniprot,
      extraction,
      addedAt: Date.now(),
    });
    setAdded(true);
  };

  const handleBack = () => {
    taskController.cancelAll();
    navigate('/');
  };

  const handleReset = () => {
    setExtraction(null);
    setPhase('idle');
    setError(null);
    setExtractedFromCache(false);
  };

  // styles
  const page: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: 'var(--space-2xl)' };
  const card: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-xl)', marginBottom: 'var(--space-xl)' };
  const btnPrimary: React.CSSProperties = { padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-base)', fontWeight: 500, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { ...btnPrimary, background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)' };
  const btnSuccess: React.CSSProperties = { ...btnPrimary, background: '#7D9DB5' };
  const errBox: React.CSSProperties = { marginTop: 'var(--space-md)', padding: 'var(--space-md)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' };
  const paramRow: React.CSSProperties = { display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' };
  const paramLabel: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' };
  const paramValue: React.CSSProperties = { fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' };

  return (
    <div style={page}>
      <header style={{ marginBottom: 'var(--space-2xl)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.01em' }}>
          Article Analysis
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
          上传文献 PDF，自动提取表达、纯化、结晶信息
        </p>
      </header>

      {/* 参数卡片 */}
      <div style={card}>
        <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: paperTitle ? 'var(--space-sm)' : 'var(--space-lg)' }}>来源</h2>
        {paperTitle && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 500, marginBottom: 'var(--space-lg)', lineHeight: 1.5 }}>
            {paperTitle}
          </div>
        )}
        <div style={paramRow}>
          {doi && (
            <div>
              <div style={paramLabel}>DOI</div>
              <a style={{ ...paramValue, color: 'var(--color-primary)' }} href={`https://doi.org/${doi}`} target="_blank" rel="noopener noreferrer">{doi}</a>
            </div>
          )}
          {pdbIds.length > 0 && (
            <div>
              <div style={paramLabel}>PDB ID</div>
              <span style={paramValue}>
                {pdbIds.map((id, i) => (
                  <span key={id}>
                    {i > 0 && ', '}
                    <a style={{ color: 'var(--color-primary)' }} href={`https://www.rcsb.org/structure/${id}`} target="_blank" rel="noopener noreferrer">{id}</a>
                  </span>
                ))}
              </span>
            </div>
          )}
          {uniprot && (
            <div>
              <div style={paramLabel}>UniProt</div>
              <span style={paramValue}>{uniprot}</span>
            </div>
          )}
        </div>
      </div>

      {/* 上传 + 提取 */}
      {!extraction && (
        <div style={card}>
          <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: 'var(--space-lg)' }}>上传文献</h2>
          <PdfUploader onUpload={handleUpload} disabled={phase === 'extracting'} />
          {phase === 'extracting' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)' }}>
              ⏳ 正在解析 PDF 并提取信息（可能需要 1-2 分钟）...
            </div>
          )}
          {error && <div style={errBox}>{error}</div>}
        </div>
      )}

      {/* 结果 */}
      {extraction && (
        <>
          {extractedFromCache && (
            <div style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', background: '#EDF3F7', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
              📦 从历史记录恢复。如需重新提取，请点击下方按钮。
            </div>
          )}
          {!extraction.verified && extraction.verificationNote && (
            <div style={{ padding: 'var(--space-md) var(--space-lg)', marginBottom: 'var(--space-md)', background: '#FFF3E0', border: '1px solid #E65100', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#E65100', fontWeight: 500 }}>
              ⚠️ 文献匹配警告：{extraction.verificationNote}
            </div>
          )}
          {extraction.verified && extraction.verificationNote && (
            <div style={{ padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', background: '#E8F5E9', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', color: '#2E7D32' }}>
              {extraction.verificationNote}
            </div>
          )}
          <ExtractionResult extraction={extraction} />
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: 'var(--space-xl)', marginBottom: 'var(--space-2xl)' }}>
            <button onClick={handleReset} style={btnSecondary}>🔄 重新上传</button>
            <button onClick={handleBack} style={btnSecondary}>← 返回搜索结果</button>
            {added ? (
              <button disabled style={{ ...btnSuccess, opacity: 0.7, cursor: 'default' }}>✓ 已加入汇总</button>
            ) : (
              <button onClick={handleAddToSummary} style={btnSecondary}>📊 加入汇总</button>
            )}
            {added && (
              <button onClick={() => navigate('/article-summary')} style={btnPrimary}>查看汇总对比</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
