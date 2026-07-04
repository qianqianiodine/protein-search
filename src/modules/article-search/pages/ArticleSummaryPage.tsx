import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { loadSummary, removeFromSummary } from '../services/summaryStorage';
import { renderMarkdown, stripMarkdown } from '../../shared/utils/markdown';
import { saveScrollPosition, restoreScrollPosition } from '../../shared/services/scrollPosition';
import type { ArticleExtraction, SummaryEntry } from '../../shared/types';

const EXCEL_FONT_COLORS: Record<string, string> = {
  construct: '4A6A8A',
  expression: '3A6B3A',
  purification: '8A6A4A',
  crystallization: '6A4A8A',
};

/** 将 markdown 文本拆成 ExcelJS 富文本段：**粗体** + 数字变色 */
function markdownToRichText(md: string, section: string): ExcelJS.RichText[] {
  const color = EXCEL_FONT_COLORS[section] || '4A6A8A';
  const segments = md.split(/(\*\*.*?\*\*)/g);
  const richText: ExcelJS.RichText[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    const m = seg.match(/^\*\*(.*?)\*\*$/);
    if (m) {
      const txt = m[1];
      const font: { bold: boolean; color?: { argb: string } } = { bold: true };
      if (/\d/.test(txt)) {
        font.color = { argb: 'FF' + color };
      }
      richText.push({ font, text: txt });
    } else {
      richText.push({ text: seg });
    }
  }
  return richText;
}

const COLUMNS: Array<{ key: keyof ArticleExtraction; label: string }> = [
  { key: 'construct', label: '蛋白构建' },
  { key: 'expression', label: '表达' },
  { key: 'purification', label: '纯化' },
  { key: 'crystallization', label: '结晶' },
];

// ---- protein group logic ----

interface ProteinGroup {
  key: string;          // 复合键: uniprot || gene || '__unknown__'
  uniprot: string;
  gene: string;
  proteinName: string;
  count: number;
}

function proteinLabel(p: ProteinGroup): string {
  const gene = (p.gene || '').trim();
  if (gene) return gene;
  const name = (p.proteinName || '').trim();
  if (name) {
    const words = name.split(/\s+/).filter(Boolean);
    return words.slice(0, 2).join(' ');
  }
  return p.uniprot || '?';
}

function buildProteinGroups(entries: SummaryEntry[]): ProteinGroup[] {
  const map = new Map<string, ProteinGroup>();
  for (const e of entries) {
    const key = e.uniprot || e.gene || '__unknown__';
    if (map.has(key)) {
      map.get(key)!.count++;
    } else {
      map.set(key, { key, uniprot: e.uniprot, gene: e.gene, proteinName: e.proteinName, count: 1 });
    }
  }
  return [...map.values()];
}

export function ArticleSummaryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialUniprot = searchParams.get('uniprot') || '';
  const initialGene = searchParams.get('gene') || '';

  const PINNED_KEY = 'article-summary-pinned';

  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(PINNED_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });

  const allEntries = loadSummary();
  const proteinGroups = useMemo(() => buildProteinGroups(allEntries), [allEntries]);

  // 滚动位置恢复
  const SCROLL_KEY = 'article-summary';
  useEffect(() => {
    restoreScrollPosition(SCROLL_KEY);
  }, []);

  // 复合键匹配：uniprot || gene，与 buildProteinGroups 一致
  const initialKey = initialUniprot || initialGene || '';
  const [selectedKey, setSelectedKey] = useState<string>(
    initialKey && proteinGroups.some((p) => p.key === initialKey)
      ? initialKey
      : proteinGroups[0]?.key || '',
  );

  const entries = useMemo(() => {
    if (!selectedKey || selectedKey === '__unknown__') return [];
    const filtered = allEntries.filter((e) => {
      const entryKey = e.uniprot || e.gene || '__unknown__';
      return entryKey === selectedKey;
    });
    // 置顶的排前面
    const pinned = filtered.filter((e) => pinnedIds.has(e.id));
    const unpinned = filtered.filter((e) => !pinnedIds.has(e.id));
    return [...pinned, ...unpinned];
  }, [allEntries, selectedKey, pinnedIds]);

  const selectedProtein = proteinGroups.find((p) => p.key === selectedKey);

  const setEntriesRefresh = useState(0)[1];
  const refresh = () => setEntriesRefresh((n) => n + 1);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const handleRemove = (id: string) => {
    removeFromSummary(id);
    refresh();
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(PINNED_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const toggleCell = (id: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const cellKey = (entryId: string, col: string) => `${entryId}-${col}`;

  const getSummary = (entry: SummaryEntry, col: (typeof COLUMNS)[0]) => {
    const s = entry.extraction.summaries?.[col.key];
    if (s) return stripMarkdown(s);
    const text = stripMarkdown(entry.extraction[col.key]);
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  };

  const handleExportExcel = async () => {
    const gene = selectedProtein?.gene || entries[0]?.gene || entries[0]?.uniprot || '未知蛋白';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${gene}_纯化表达文献汇总_${date}.xlsx`;

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('汇总对比');

    // 列宽
    ws.columns = [
      { width: 30 }, { width: 12 }, { width: 50 }, { width: 50 }, { width: 50 }, { width: 50 },
    ];

    // 标题行（粗体）
    const headerRow = ws.addRow(['文献', 'PDB', '蛋白构建', '表达', '纯化', '结晶']);
    headerRow.font = { bold: true };

    for (const e of entries) {
      const row = ws.addRow([
        e.doi || e.title || e.pdbId || e.uniprot,
        e.pdbId,
        stripMarkdown(e.extraction.construct),
        stripMarkdown(e.extraction.expression),
        stripMarkdown(e.extraction.purification),
        stripMarkdown(e.extraction.crystallization),
      ]);

      // 对每个提取字段，检测是否有 markdown **bold** 格式，有则用富文本
      const cols = COLUMNS;
      for (let i = 0; i < cols.length; i++) {
        const rawText = e.extraction[cols[i].key];
        if (/\*\*.*?\*\*/.test(rawText)) {
          row.getCell(i + 3).value = { richText: markdownToRichText(rawText, cols[i].key) };
        }
      }
    }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ---- navigate to article analysis ----
  const handleTitleClick = (entry: SummaryEntry) => {
    const params = new URLSearchParams();
    if (entry.doi) params.set('doi', entry.doi);
    if (entry.id) params.set('extractionId', entry.id);
    if (entry.pdbId) params.set('pdb', entry.pdbId);
    if (entry.uniprot) params.set('uniprot', entry.uniprot);
    if (entry.proteinName) params.set('proteinName', entry.proteinName);
    if (entry.gene) params.set('gene', entry.gene);
    if (entry.title) params.set('title', entry.title);
    saveScrollPosition(SCROLL_KEY);
    navigate(`/article-search?${params.toString()}`);
  };
  const iconSpan: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em', lineHeight: 1, flexShrink: 0 };

  if (allEntries.length === 0) {
    const page: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: 'var(--space-2xl)', textAlign: 'center' };
    return (
      <div style={page}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>汇总对比</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>还没有加入任何文献</p>
        <div style={{ display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
          <button
            style={{ padding: 'calc(var(--space-md) * 0.7) calc(var(--space-xl) * 0.8)', fontSize: 'var(--text-base)', fontWeight: 600, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 }}
            onClick={() => navigate('/article-search')}
          >
            提交文献
          </button>
          <button
            style={{ padding: 'calc(var(--space-md) * 0.7) calc(var(--space-xl) * 0.8)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 }}
            onClick={() => navigate('/')}
          >
            <span style={iconSpan}>◀️</span> 回搜索页
          </button>
        </div>
      </div>
    );
  }

  // ---- styles ----
  const page: React.CSSProperties = { maxWidth: 1400, margin: '0 auto', padding: 'var(--space-2xl)' };
  const thStyle: React.CSSProperties = { padding: 'var(--space-md)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', borderBottom: '2px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: 'var(--space-md)', fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top', maxWidth: 300 };
  const summaryStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 };
  const removeBtn: React.CSSProperties = { padding: 0, width: 24, height: 24, fontSize: '14px', lineHeight: '24px', textAlign: 'center', color: 'var(--color-danger)', background: 'transparent', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', marginBottom: 4, display: 'block' };
  const pinStyle = (id: string): React.CSSProperties => {
    const pinned = pinnedIds.has(id);
    return {
      padding: 0, width: 24, height: 24, fontSize: '14px', lineHeight: '24px', textAlign: 'center',
      color: pinned ? '#fff' : 'var(--color-primary)',
      background: pinned ? 'var(--color-primary)' : 'transparent',
      border: `1px solid var(--color-primary)`, borderRadius: 'var(--radius-sm)',
      cursor: 'pointer', marginBottom: 4, display: 'block',
    };
  };
  const btnSecondary: React.CSSProperties = { padding: 'calc(var(--space-sm) * 0.7) calc(var(--space-lg) * 0.8)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3em', lineHeight: 1.2 };

  const activeProteinCard: React.CSSProperties = {
    padding: 'var(--space-sm) var(--space-lg)',
    background: 'var(--color-primary)',
    color: '#fff',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    border: 'none',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontSize: 'var(--text-sm)',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    lineHeight: 1.2,
  };

  const inactiveProteinCard: React.CSSProperties = {
    ...activeProteinCard,
    background: 'var(--color-surface)',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border)',
    fontWeight: 500,
  };

  return (
    <div style={page}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>汇总对比</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            {proteinGroups.length} 个蛋白 · {allEntries.length} 篇文献
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button style={btnSecondary} onClick={handleExportExcel}>导出 Excel</button>
          <button
            style={btnSecondary}
            onClick={() => {
              const p = selectedProtein;
              const params = new URLSearchParams();
              // uniprot 为空时用 gene 作为蛋白标识（与 buildProteinGroups 复合键一致）
              if (p?.uniprot) params.set('uniprot', p.uniprot);
              else if (p?.gene) params.set('uniprot', p.gene);
              if (p?.proteinName) params.set('proteinName', p.proteinName);
              if (p?.gene) params.set('gene', p.gene);
              navigate(`/article-search?${params.toString()}`);
            }}
          >
            提交文献
          </button>
          <button style={btnSecondary} onClick={() => navigate('/')}><span style={iconSpan}>◀️</span> 回搜索页</button>
        </div>
      </header>

      {/* ---- 蛋白选择面板 ---- */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {proteinGroups.map((p) => {
          const isActive = p.key === selectedKey;
          const style = isActive ? activeProteinCard : inactiveProteinCard;
          return (
            <button key={p.key} style={style} onClick={() => setSelectedKey(p.key)}>
              {proteinLabel(p)} · {p.count} 篇
            </button>
          );
        })}
      </div>

      {/* ---- 选中蛋白的文献表格 ---- */}
      {selectedProtein && entries.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {selectedProtein.gene || selectedProtein.uniprot}
            </h2>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {selectedProtein.proteinName}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: 120 }}>文献</th>
                  <th style={{ ...thStyle, width: 70 }}>PDB</th>
                  {COLUMNS.map((col) => (<th key={col.key} style={thStyle}>{col.label}</th>))}
                  <th style={{ ...thStyle, width: 60 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td
                      style={{ ...tdStyle, cursor: 'pointer' }}
                      onClick={() => handleTitleClick(entry)}
                      title="点击查看文献分析详情"
                    >
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 4, color: 'var(--color-primary)' }}>
                        {entry.title || entry.pdbId || entry.uniprot}
                      </div>
                      {entry.doi && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{entry.doi}</div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{entry.pdbId}</td>
                    {COLUMNS.map((col) => {
                      const ck = cellKey(entry.id, col.key);
                      const isExpanded = expandedCells.has(ck);
                      const fullText = entry.extraction[col.key];
                      const hasSummary = !!entry.extraction.summaries?.[col.key];
                      return (
                        <td
                          key={col.key}
                          style={{ ...tdStyle, cursor: fullText ? 'pointer' : 'default' }}
                          onClick={() => {
                            if (!fullText) return;
                            // 有选中文本 → 用户正在拖选复制，不触发切换
                            const sel = window.getSelection();
                            if (sel && sel.toString().length > 0) return;
                            toggleCell(ck);
                          }}
                        >
                          {isExpanded ? (
                            <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(fullText, col.key) }} />
                          ) : (
                            <div style={summaryStyle}>
                              {getSummary(entry, col)}
                              {!hasSummary && fullText.length > 100 && (
                                <span style={{ color: 'var(--color-primary)', marginLeft: 4 }}>展开</span>
                              )}
                            </div>
                          )}
                          {isExpanded && (
                            <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', marginTop: 4, display: 'inline-block' }}>收起</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={tdStyle}>
                      <button style={pinStyle(entry.id)} onClick={() => togglePin(entry.id)} title={pinnedIds.has(entry.id) ? '取消置顶' : '置顶'}>📌</button>
                      <button style={removeBtn} onClick={() => handleRemove(entry.id)} title="移除">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)' }}>当前未分析文献</p>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>在蛋白搜索结果中点击「分析」，或直接提交文献 PDF</p>
          <button
            style={btnSecondary}
            onClick={() => {
              const p = selectedProtein;
              const params = new URLSearchParams();
              // uniprot 为空时用 gene 作为蛋白标识（与 buildProteinGroups 复合键一致）
              if (p?.uniprot) params.set('uniprot', p.uniprot);
              else if (p?.gene) params.set('uniprot', p.gene);
              if (p?.proteinName) params.set('proteinName', p.proteinName);
              if (p?.gene) params.set('gene', p.gene);
              navigate(`/article-search?${params.toString()}`);
            }}
          >
            提交文献
          </button>
        </div>
      )}
    </div>
  );
}
