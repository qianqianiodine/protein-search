import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadSummary, removeFromSummary } from '../services/summaryStorage';
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
  const [expandedCell, setExpandedCell] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    removeFromSummary(id);
    setEntries(loadSummary());
  };

  const toggleCell = (id: string) => {
    setExpandedCell((prev) => (prev === id ? null : id));
  };

  const cellKey = (entryId: string, col: string) => `${entryId}-${col}`;

  // 截取预览文本
  const preview = (text: string, max = 100) =>
    text.length > max ? text.slice(0, max) + '...' : text;

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
  const removeBtn: React.CSSProperties = { padding: '2px 8px', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: 'transparent', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' };

  return (
    <div style={page}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text)' }}>汇总对比</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', marginTop: 4 }}>{entries.length} 篇文献</p>
        </div>
        <button
          style={{ padding: 'var(--space-sm) var(--space-lg)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
          onClick={() => navigate('/')}
        >
          回搜索页
        </button>
      </header>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 120 }}>文献</th>
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
                {COLUMNS.map((col) => {
                  const ck = cellKey(entry.id, col.key);
                  const isExpanded = expandedCell === ck;
                  const text = entry.extraction[col.key];
                  return (
                    <td
                      key={col.key}
                      style={{ ...tdStyle, cursor: text.length > 100 ? 'pointer' : 'default' }}
                      onClick={() => text.length > 100 && toggleCell(ck)}
                    >
                      {isExpanded ? (
                        <div
                          dangerouslySetInnerHTML={{
                            __html: text
                              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                              .replace(/^- (.+)$/gm, '<li>$1</li>')
                              .replace(/\n\n/g, '<br><br>')
                              .replace(/\n/g, '<br>'),
                          }}
                        />
                      ) : (
                        <span>{preview(text)}</span>
                      )}
                      {text.length > 100 && (
                        <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', marginLeft: 4 }}>
                          {isExpanded ? '收起' : '展开'}
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
