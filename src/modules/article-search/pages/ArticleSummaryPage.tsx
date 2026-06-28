import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
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
  const [searchParams] = useSearchParams();
  const filterUniprot = searchParams.get('uniprot') || '';
  const filterGene = searchParams.get('gene') || '';

  const allEntries = loadSummary();
  const entries = useMemo(() => {
    if (!filterUniprot) return allEntries;
    return allEntries.filter((e) => e.uniprot === filterUniprot);
  }, [allEntries, filterUniprot]);

  const setEntriesRefresh = useState(0)[1];
  const refresh = () => setEntriesRefresh((n) => n + 1);
  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

  const handleRemove = (id: string) => {
    removeFromSummary(id);
    refresh();
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

  /** 板块 → Excel 深色字体映射 */
  const EXCEL_FONT_COLORS: Record<string, string> = {
    construct: '4A6A8A',
    expression: '3A6B3A',
    purification: '8A6A4A',
    crystallization: '6A4A8A',
  };

  /** 将 Markdown 转为 xlsx 富文本 XML 片段（仅 <r> 元素，无 <si> 包装） */
  const markdownToRichRuns = (md: string, section: string): string => {
    const color = EXCEL_FONT_COLORS[section] || '4A6A8A';
    const segments = md.split(/(\*\*.*?\*\*)/g);
    const runs: string[] = [];
    for (const seg of segments) {
      if (!seg) continue;
      const m = seg.match(/^\*\*(.*?)\*\*$/);
      if (m) {
        const txt = escapeXml(m[1]);
        if (/\d/.test(txt)) {
          runs.push(`<r><rPr><b/><color rgb="FF${color}"/></rPr><t>${txt}</t></r>`);
        } else {
          runs.push(`<r><rPr><b/></rPr><t>${txt}</t></r>`);
        }
      } else {
        runs.push(`<r><t xml:space="preserve">${escapeXml(seg)}</t></r>`);
      }
    }
    return runs.join('');
  };

  /** XML 特殊字符转义 */
  const escapeXml = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /** 导出 Excel（富文本：加粗 + 板块色字体，通过 JSZip 后处理 SST XML） */
  const handleExportExcel = async () => {
    const gene = entries[0]?.gene || entries[0]?.proteinName || entries[0]?.uniprot || entries[0]?.pdbId || '未知蛋白';
    const date = new Date().toISOString().slice(0, 10);
    const filename = `${gene}_纯化表达文献汇总_${date}.xlsx`;

    // 第一步：构建纯文本工作表
    const header = ['文献', 'PDB', '蛋白构建', '表达', '纯化', '结晶'];
    const rows: string[][] = [header];
    for (const e of entries) {
      rows.push([
        e.doi || e.title || e.pdbId || e.uniprot,
        e.pdbId,
        stripMarkdown(e.extraction.construct),
        stripMarkdown(e.extraction.expression),
        stripMarkdown(e.extraction.purification),
        stripMarkdown(e.extraction.crystallization),
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 30 }, { wch: 12 }, { wch: 50 }, { wch: 50 }, { wch: 50 }, { wch: 50 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '汇总对比');

    // 第二步：用 bookSST: true 写入数组缓冲区
    const wbout = XLSX.write(wb, { type: 'array', bookSST: true });

    // 第三步：构建 plainText → richRuns 映射
    const richTextMap = new Map<string, string>();
    for (const e of entries) {
      for (const col of COLUMNS) {
        const plainText = stripMarkdown(e.extraction[col.key]);
        if (!richTextMap.has(plainText)) {
          richTextMap.set(plainText, markdownToRichRuns(e.extraction[col.key], col.key));
        }
      }
    }

    // 第四步：用 JSZip 后处理共享字符串 XML
    const zip = await JSZip.loadAsync(wbout);
    const sstFile = zip.file('xl/sharedStrings.xml');
    if (sstFile) {
      let sstXml = await sstFile.async('string');

      for (const [plainText, richRuns] of richTextMap) {
        const escaped = plainText
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const escapedForRegex = escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // 替换 <si><t ...>escaped</t></si> 为 <si>richRuns</si>
        const regex = new RegExp(
          `<si><t(?: xml:space="preserve")?>${escapedForRegex}</t></si>`,
          'g'
        );
        sstXml = sstXml.replace(regex, `<si>${richRuns}</si>`);
      }

      zip.file('xl/sharedStrings.xml', sstXml);
    }

    // 第五步：生成 Blob 并触发下载
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
            {filterGene ? `${filterGene} · ` : ''}{entries.length} 篇文献
          </p>
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
                  {(entry.title && entry.title !== entry.doi && entry.title !== entry.pdbId && entry.title !== entry.uniprot) ? (
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 4 }}>{entry.title}</div>
                  ) : (
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-xs)', marginBottom: 4 }}>{entry.pdbId || entry.uniprot}</div>
                  )}
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', wordBreak: 'break-all' }}>{entry.doi}</div>
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
