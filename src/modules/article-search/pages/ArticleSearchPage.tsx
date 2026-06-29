import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { analysisTaskManager } from '../services/analysisTaskManager';
import { clearPendingPdfs } from '../services/pdfFileCache';
import { addToSummary, isInSummary, removeFromSummary, loadSummary } from '../services/summaryStorage';
import {
  loadArticleExtraction,
  loadArticleExtractionById,
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
  const gene = searchParams.get('gene') || '';
  const paperTitle = searchParams.get('title') || '';
  const extractionId = searchParams.get('extractionId') || '';

  // 页面加载时检查缓存：优先 extractionId，其次 doi+uniprot（无 doi → 新提交不查缓存）
  const cached = extractionId
    ? loadArticleExtractionById(extractionId)
    : doi && uniprot
      ? loadArticleExtraction(doi, uniprot)
      : null;
  const [phase, setPhase] = useState<Phase>(cached ? 'done' : 'idle');
  const [extraction, setExtraction] = useState<ArticleExtraction | null>(
    cached?.extraction || null,
  );
  const [extractedFromCache, setExtractedFromCache] = useState(!!cached);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(() => isInSummary(doi, uniprot));
  const activeTaskIdRef = useRef<string | null>(null);

  // Bug③修复：当 doi/uniprot 变化时（如同页面从通知跳转到不同文献），重置所有状态
  useEffect(() => {
    // 先按 extractionId 查找，再按 doi+uniprot 查找（无 doi → 新提交，不查缓存）
    const newCached = extractionId
      ? loadArticleExtractionById(extractionId)
      : doi && uniprot
        ? loadArticleExtraction(doi, uniprot)
        : null;
    if (newCached) {
      setExtraction(newCached.extraction);
      setPhase('done');
      setExtractedFromCache(true);
      setAdded(isInSummary(doi, uniprot));
      setError(null);
    } else {
      const existingTask = extractionId
        ? analysisTaskManager.getTask(extractionId)
        : doi && uniprot
          ? analysisTaskManager.getTaskByMetadata(doi, uniprot)
          : undefined;
      if (existingTask?.status === 'completed' && existingTask.extraction) {
        setExtraction(existingTask.extraction);
        setPhase('done');
        setExtractedFromCache(false);
        setAdded(isInSummary(doi, uniprot));
        setError(null);
      } else if (existingTask?.status === 'running') {
        setExtraction(null);
        setPhase('extracting');
        setExtractedFromCache(false);
        setError(null);
        activeTaskIdRef.current = existingTask.id;
      } else if (existingTask?.status === 'failed') {
        setExtraction(null);
        setPhase('idle');
        setExtractedFromCache(false);
        setError(existingTask.error || '提取失败');
      } else {
        setExtraction(null);
        setPhase('idle');
        setExtractedFromCache(false);
        setError(null);
      }
    }
    // Bug①修复：切换文献时清除旧 PDF 缓存
    clearPendingPdfs();
  }, [doi, uniprot, extractionId]);

  // Bug①修复：离开页面时清除 PDF 缓存
  useEffect(() => {
    return () => {
      clearPendingPdfs();
    };
  }, []);

  // 监听 taskManager：当前任务完成时更新 UI
  useEffect(() => {
    const unsubscribe = analysisTaskManager.subscribe(() => {
      const taskId = activeTaskIdRef.current;
      if (!taskId) return;
      const task = analysisTaskManager.getTask(taskId);
      if (!task) {
        // 任务已消除（被 dismiss），忽略
        return;
      }
      if (task.status === 'completed' && task.extraction) {
        setExtraction(task.extraction);
        setPhase('done');
        setAdded(isInSummary(doi, uniprot));
        clearPendingPdfs();
        setExtractedFromCache(false);
        activeTaskIdRef.current = null;
      } else if (task.status === 'failed') {
        setError(task.error || '提取失败');
        setPhase('idle');
        activeTaskIdRef.current = null;
      }
    });
    return unsubscribe;
  }, [doi, uniprot]);

  const handleUpload = useCallback(
    (mainPdf: File, suppPdf?: File | null) => {
      setPhase('extracting');
      setError(null);
      setExtractedFromCache(false);

      const taskId = analysisTaskManager.startTask(
        { doi, pdb, uniprot, proteinName, gene, paperTitle },
        mainPdf,
        suppPdf,
      );
      activeTaskIdRef.current = taskId;
    },
    [doi, pdb, uniprot, proteinName, gene, paperTitle],
  );

  const handleToggleSummary = () => {
    if (!extraction) return;
    if (added) {
      // 从汇总中移除
      const entries = loadSummary();
      const entry = entries.find((e) => e.doi === doi && e.uniprot === uniprot);
      if (entry) {
        removeFromSummary(entry.id);
      }
      setAdded(false);
    } else {
      const id = `${doi}-${uniprot}-${Date.now()}`;
      addToSummary({
        id,
        doi,
        pdbId: pdb,
        uniprot,
        proteinName,
        gene,
        title: paperTitle || extraction.paperTitle || doi || pdb || uniprot,
        extraction,
        addedAt: Date.now(),
      });
      setAdded(true);
    }
  };

  const handleBack = () => {
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
  // 结果区按钮（标准大小 — 垂直 padding 缩 30%、水平缩 20%，居中）
  const btnBase: React.CSSProperties = { padding: 'calc(var(--space-md) * 0.7) calc(var(--space-xl) * 0.8)', fontSize: 'var(--text-base)', fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3em', lineHeight: 1.2 };
  const btnPrimary: React.CSSProperties = { ...btnBase, color: '#fff', background: 'var(--color-primary)' };
  const btnSecondary: React.CSSProperties = { ...btnBase, background: 'var(--color-surface)', color: 'var(--color-text)', border: '2px solid var(--color-border)' };
  const btnSuccess: React.CSSProperties = { ...btnBase, background: '#7D9DB5', color: '#fff' };
  // 头部导航按钮（小号 — 垂直 padding 缩 30%、水平缩 20%，居中）
  const btnSm: React.CSSProperties = { padding: 'calc(var(--space-sm) * 0.7) calc(var(--space-lg) * 0.8)', fontSize: 'var(--text-sm)', fontWeight: 600, borderRadius: 6, cursor: 'pointer', border: '2px solid', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3em', lineHeight: 1.2 };
  const btnBlue: React.CSSProperties = { ...btnSm, background: '#E3F0FA', borderColor: '#9BC3E0', color: 'var(--color-text)' };
  const btnPink: React.CSSProperties = { ...btnSm, background: '#FDE8EC', borderColor: '#E8B4BC', color: 'var(--color-text)' };
  // 图标徽章 span — 纯 flex 居中（字符自带灰底灰框外观）
  const iconSpan: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em', lineHeight: 1, flexShrink: 0 };
  // emoji 专用 span — 纯居中，无徽章（🔄）
  const emojiSpan: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em', lineHeight: 1, flexShrink: 0 };
  const errBox: React.CSSProperties = { marginTop: 'var(--space-md)', padding: 'var(--space-md)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' };
  const paramRow: React.CSSProperties = { display: 'flex', gap: 'var(--space-xl)', flexWrap: 'wrap', marginBottom: 'var(--space-md)' };
  const proteinInfoCard: React.CSSProperties = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg) var(--space-xl)', marginBottom: 'var(--space-xl)', display: 'flex', alignItems: 'center', gap: 'var(--space-xl)', flexWrap: 'wrap' };
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

      {/* 参数卡片 / 蛋白信息栏 */}
      {(doi || pdbIds.length > 0) ? (
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
      ) : (
        <div style={proteinInfoCard}>
          {gene && (
            <div>
              <span style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>{gene}</span>
              {proteinName && (
                <span style={{ color: 'var(--color-text-secondary)', marginLeft: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
                  ({proteinName})
                </span>
              )}
            </div>
          )}
          {uniprot && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-primary)', fontWeight: 500 }}>
              {uniprot}
            </span>
          )}
          {!gene && !uniprot && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>未关联蛋白</span>
          )}
        </div>
      )}

      {/* 上传 + 提取 */}
      {!extraction && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h2 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>上传文献</h2>
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button onClick={handleBack} style={btnBlue}><span style={iconSpan}>◀️</span> 返回搜索</button>
              <button onClick={() => navigate(`/article-summary?uniprot=${encodeURIComponent(uniprot)}&gene=${encodeURIComponent(gene)}`)} style={btnPink}><span style={iconSpan}>◀️</span> 返回汇总</button>
            </div>
          </div>
          <PdfUploader onUpload={handleUpload} disabled={phase === 'extracting'} />
          {phase === 'extracting' && (
            <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-secondary)' }}>
              <div>⏳ 正在解析 PDF 并提取信息（可能需要 1-2 分钟）...</div>
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
            <button onClick={handleReset} style={btnSecondary}><span style={emojiSpan}>🔄</span> 重新上传</button>
            <button onClick={handleBack} style={btnSecondary}><span style={iconSpan}>◀️</span> 返回搜索</button>
            {added ? (
              <button onClick={handleToggleSummary} style={btnSuccess}>已加入汇总（点击取消）</button>
            ) : (
              <button onClick={handleToggleSummary} style={btnSecondary}><span style={iconSpan}>➕</span> 加入汇总</button>
            )}
            <button onClick={() => navigate(`/article-summary?uniprot=${encodeURIComponent(uniprot)}&gene=${encodeURIComponent(gene)}`)} style={btnPrimary}>查看汇总对比</button>
          </div>
        </>
      )}
    </div>
  );
}
