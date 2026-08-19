import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ExcelJS from 'exceljs';
import { loadSummary, loadProteinOrder, removeFromSummary, saveProteinOrder, saveSummary } from '../services/summaryStorage';
import { renderMarkdown, stripMarkdown, stripSummaryLines } from '../../shared/utils/markdown';
import { saveScrollPosition, restoreScrollPosition } from '../../shared/services/scrollPosition';
import type { ArticleExtraction, SummaryEntry } from '../../shared/types';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

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

// ---- 可拖拽蛋白卡片（内联组件） ----

interface SortableProteinCardProps {
  protein: ProteinGroup;
  isActive: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  activeStyle: React.CSSProperties;
  inactiveStyle: React.CSSProperties;
}

function SortableProteinCard({ protein, isActive, onClick, onContextMenu, activeStyle, inactiveStyle }: SortableProteinCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: protein.key });

  const baseStyle = isActive ? activeStyle : inactiveStyle;
  const transformStr = transform
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : undefined;

  const style: React.CSSProperties = {
    ...baseStyle,
    transform: transformStr,
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const handleStyle: React.CSSProperties = {
    cursor: 'grab',
    userSelect: 'none' as const,
    marginRight: 2,
    fontSize: '1.1em',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    touchAction: 'none',
  };

  return (
    <button ref={setNodeRef} style={style} onContextMenu={onContextMenu}>
      <span {...attributes} {...listeners} style={handleStyle} aria-label="拖拽排序">⠿</span>
      <span onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ cursor: 'pointer' }}>
        {proteinLabel(protein)} · {protein.count} 篇
      </span>
    </button>
  );
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
  const [proteinOrder, setProteinOrder] = useState<string[]>(() => loadProteinOrder());

  const proteinGroups = useMemo(() => {
    const groups = buildProteinGroups(allEntries);
    // 按保存的顺序排列
    if (proteinOrder.length > 0) {
      const orderMap = new Map(proteinOrder.map((k, i) => [k, i]));
      groups.sort((a, b) => {
        const ai = orderMap.get(a.key) ?? Infinity;
        const bi = orderMap.get(b.key) ?? Infinity;
        return ai - bi;
      });
    }
    return groups;
  }, [allEntries, proteinOrder]);

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

  // ---- 拖拽传感器 ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setEntriesRefresh = useState(0)[1];
  const refresh = () => setEntriesRefresh((n) => n + 1);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // 用当前显示顺序（而非 localStorage 顺序）来找索引，避免首次/新增时 order 不完整
    const currentKeys = proteinGroups.map((p) => p.key);
    const oldIndex = currentKeys.indexOf(String(active.id));
    const newIndex = currentKeys.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(currentKeys, oldIndex, newIndex);
    setProteinOrder(newOrder);
    saveProteinOrder(newOrder);
  }, [proteinGroups]);

  // ---- 右键菜单 ----
  interface CtxMenu { x: number; y: number; proteinKey: string; }
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCtxMenu(); };
    document.addEventListener('click', closeCtxMenu);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', closeCtxMenu);
      document.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu, closeCtxMenu]);

  const handleContextMenu = (e: React.MouseEvent, proteinKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, proteinKey });
  };

  const handleBulkDelete = () => {
    if (!ctxMenu) return;
    const protein = proteinGroups.find((p) => p.key === ctxMenu.proteinKey);
    if (!protein) return;
    const label = proteinLabel(protein);
    if (!window.confirm(`确定删除 ${label} 的全部 ${protein.count} 篇文献？不可恢复。`)) return;

    const remaining = allEntries.filter((e) => {
      const ek = e.uniprot || e.gene || '__unknown__';
      return ek !== ctxMenu.proteinKey;
    });
    saveSummary(remaining);

    const newOrder = proteinOrder.filter((k) => k !== ctxMenu.proteinKey);
    setProteinOrder(newOrder);
    saveProteinOrder(newOrder);

    if (selectedKey === ctxMenu.proteinKey) {
      const groups = buildProteinGroups(remaining);
      setSelectedKey(groups[0]?.key || '');
    }

    setCtxMenu(null);
    refresh();
  };

  // ---- 单条删除时清理 order ----
  const handleRemove = (id: string) => {
    const entry = allEntries.find((e) => e.id === id);
    const proteinKey = entry ? (entry.uniprot || entry.gene || '__unknown__') : null;
    removeFromSummary(id);
    if (proteinKey) {
      const remaining = loadSummary();
      const stillExists = remaining.some((e) => (e.uniprot || e.gene || '__unknown__') === proteinKey);
      if (!stillExists) {
        const newOrder = proteinOrder.filter((k) => k !== proteinKey);
        setProteinOrder(newOrder);
        saveProteinOrder(newOrder);
        if (selectedKey === proteinKey) {
          const groups = buildProteinGroups(remaining);
          setSelectedKey(groups[0]?.key || '');
        }
      }
    }
    refresh();
  };

  const [expandedCells, setExpandedCells] = useState<Set<string>>(new Set());

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
    const text = stripMarkdown(stripSummaryLines(entry.extraction[col.key]));
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
        stripMarkdown(stripSummaryLines(e.extraction.construct)),
        stripMarkdown(stripSummaryLines(e.extraction.expression)),
        stripMarkdown(stripSummaryLines(e.extraction.purification)),
        stripMarkdown(stripSummaryLines(e.extraction.crystallization)),
      ]);

      // 对每个提取字段，检测是否有 markdown **bold** 格式，有则用富文本
      const cols = COLUMNS;
      for (let i = 0; i < cols.length; i++) {
        const rawText = stripSummaryLines(e.extraction[cols[i].key]);
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
  const removeBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '1.3rem', fontWeight: 700, color: '#d4a0a0', lineHeight: 1,
    padding: '2px 4px', borderRadius: 'var(--radius-sm)',
    display: 'block', marginBottom: 8,
  };
  const pinStyle = (id: string): React.CSSProperties => {
    const pinned = pinnedIds.has(id);
    return {
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: pinned ? '1.2rem' : '1.35rem',
      fontWeight: pinned ? 400 : 600, lineHeight: 1,
      color: pinned ? '#f0b400' : '#d4b868',
      padding: '2px 4px', borderRadius: 'var(--radius-sm)',
      display: 'block', marginBottom: 8,
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

      {/* ---- 蛋白选择面板（可拖拽排序） ---- */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={proteinGroups.map((p) => p.key)} strategy={horizontalListSortingStrategy}>
          <div style={{ display: 'flex', gap: 'var(--space-md)', overflowX: 'auto', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
            {proteinGroups.map((p) => {
              const isActive = p.key === selectedKey;
              return (
                <SortableProteinCard
                  key={p.key}
                  protein={p}
                  isActive={isActive}
                  onClick={() => setSelectedKey(p.key)}
                  onContextMenu={(e) => handleContextMenu(e, p.key)}
                  activeStyle={activeProteinCard}
                  inactiveStyle={inactiveProteinCard}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

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
                            <div className="md-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(stripSummaryLines(fullText), col.key) }} />
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
                      <button style={pinStyle(entry.id)} onClick={() => togglePin(entry.id)} title={pinnedIds.has(entry.id) ? '取消置顶' : '置顶'}>{pinnedIds.has(entry.id) ? '⭐' : '☆'}</button>
                      <button style={removeBtn} onClick={() => handleRemove(entry.id)} title="移除">×</button>
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

      {/* ---- 右键菜单 ---- */}
      {ctxMenu && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(ctxMenu.x, window.innerWidth - 210),
            top: Math.min(ctxMenu.y, window.innerHeight - 60),
            zIndex: 1000,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
            padding: 'var(--space-sm) 0',
            minWidth: 220,
            border: '1px solid var(--color-border)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const protein = proteinGroups.find((p) => p.key === ctxMenu.proteinKey);
            const label = protein ? proteinLabel(protein) : '';
            return (
              <button
                style={{
                  display: 'block',
                  width: '100%',
                  padding: 'var(--space-sm) var(--space-lg)',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                  textAlign: 'left',
                  color: 'var(--color-text)',
                  lineHeight: 1.4,
                }}
                onClick={handleBulkDelete}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.color = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'none';
                  e.currentTarget.style.color = 'var(--color-text)';
                }}
              >
                删除 {label ? `「${label}」` : ''} 的全部文献
              </button>
            );
          })()}
        </div>
      )}
    </div>
  );
}
