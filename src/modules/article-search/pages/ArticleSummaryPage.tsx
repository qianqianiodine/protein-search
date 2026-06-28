import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { loadSummary, removeFromSummary } from '../services/summaryStorage';
import { renderMarkdown, stripMarkdown } from '../../shared/utils/markdown';
import type { ArticleExtraction, SummaryEntry } from '../../shared/types';

const COLUMNS: Array<{ key: keyof ArticleExtraction; label: string }> = [
  { key: 'construct', label: '蛋白构建' },
  { key: 'expression', label: '表达' },
  { key: 'purification', label: '纯化' },
  { key: 'crystallization', label: '结晶' },
];

export function ArticleSummaryPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<SummaryEntry[]>(loadSummary);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const handleRemove = (id: string) => {
    removeFromSummary(id);
    setEntries(loadSummary());
  };

  const toggleCell = (id: string) => {
    setExpandedCells((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const cellKey = (entryId: string, col: string) => `${entryId}-${col}`;

  /** 获取摘要文本：优先 DeepSeek 摘要，旧缓存兜底用 preview（移除 Markdown 标记） */
  const getSummary = (entry: SummaryEntry, col: (typeof COLUMNS)[0]) => {
    const s = entry.extraction.summaries?.[col.key];
    if (s) return stripMarkdown(s);
    // 旧缓存兼容：截取前 100 字
    const text = stripMarkdown(entry.extraction[col.key]);
    return text.length > 100 ? text.slice(0, 100) + '...' : text;
  };

  /** 导出 Excel */
  const handleExportExcel = () => {
    const proteinName = entries[0]?.pdbId || entries[0]?.uniprot || '未知蛋白';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${proteinName}_纯化表达文献汇总_${date}.xlsx`;

    const data = entries.map((e) => ({
      '文献': e.doi || e.title || e.pdbId || e.uniprot,
      'PDB': e.pdbId,
      '蛋白构建': stripMarkdown(e.extraction.construct),
      '表达': stripMarkdown(e.extraction.expression),
      '纯化': stripMarkdown(e.extraction.purification),
      '结晶': stripMarkdown(e.extraction.crystallization),
    }));

    const ws = XLSX.utils.json_to_sheet(data);

    // 列宽自适应
    const colWidths = [
      { wch: 30 }, // 文献
      { wch: 12 }, // PDB
      { wch: 50 }, // 蛋白构建
      { wch: 50 }, // 表达
      { wch: 50 }, // 纯化
      { wch: 50 }, // 结晶
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '汇总对比');
    XLSX.writeFile(wb, filename);
  };

  if (entries.length === 0) {
    const page: React.CSSProperties = { maxWidth: 1000, margin: '0 auto', padding: 'var(--space-2xl)', textAlign: 'center' };
    return (
      <div style={page}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 'var(--space-lg)' }}>汇总对比</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-xl)' }}>还没有加入任何文献</p>
        <button
          style={{ padding: 'var(--space-md) var(--space-xl)', fontSize: 'var(--text-base)', fontWeight: 500, color: '#fff', background: 'var(--color-primary)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          回搜索页
        </button>
      </div>
    );
  }

  const page: React.CSSProperties = { maxWidth: 1400, margin: '0 auto', padding: 'var(--space-2xl)' };
  const thStyle: React.CSSProperties = { padding: 'var(--space-md)', fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)', borderBottom: '2px solid var(--color-border)', textAlign: 'left', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: 'var(--space-md)', fontSize: 'var(--text-xs)', lineHeight: 1.6, color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', verticalAlign: 'top', maxWidth: 300 };
  const summaryStyle: React.CSSProperties = { fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 };
  const removeBtn: React.CSSProperties = { padding: '2px 8px', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: 'transparent', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };
  const btnSecondary: React.CSSProperties = { padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' };

  return (
    <div style={page}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>汇总对比</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{entries.length} 篇文献</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <button style={btnSecondary} onClick={handleExportExcel}>📥 导出 Excel</button>
          <button style={btnSecondary} onClick={() => navigate('/')}>回搜索页</button>
        </div>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 120 }}>文献</th>
              <th style={{ ...thStyle, width: 70 }}>PDB</th>
              {COLUMNS.map((col) => (
                <th key={col.key} style={thStyle}>{col.label}</th>
              ))}
              <th style={{ ...thStyle, width: 60 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td style={tdStyle}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)' }}>{entry.pdbId || entry.uniprot}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', wordBreak: 'break-all', marginTop: 4 }}>{entry.doi}</div>
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
                      onClick={() => fullText && toggleCell(ck)}
                    >
                      {isExpanded ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(fullText, col.key) }}
                        />
                      ) : (
                        <div style={summaryStyle}>
                          {getSummary(entry, col)}
                          {!hasSummary && fullText.length > 100 && (
                            <span style={{ color: 'var(--color-primary)', marginLeft: 4 }}>展开</span>
                          )}
                        </div>
                      )}
                      {isExpanded && (
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', marginTop: 4, display: 'inline-block' }}>
                          收起
                        </span>
                      )}
                    </td>
                  );
                })}
                <td style={tdStyle}>
                  <button style={removeBtn} onClick={() => handleRemove(entry.id)}>移除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
