import { useCallback, useRef, useState } from 'react';
import type { ArticleExtraction } from '../../shared/types';
import { AnnotationToolbar } from './AnnotationToolbar';

const SECTIONS: Array<{ key: keyof ArticleExtraction; label: string; icon: string }> = [
  { key: 'construct', label: '蛋白构建', icon: '🧬' },
  { key: 'expression', label: '表达', icon: '🦠' },
  { key: 'purification', label: '纯化', icon: '🧪' },
  { key: 'crystallization', label: '结晶', icon: '💎' },
];

interface ExtractionResultProps {
  extraction: ArticleExtraction;
}

export function ExtractionResult({ extraction }: ExtractionResultProps) {
  return (
    <div>
      {SECTIONS.map(({ key, label, icon }) => (
        <SectionBlock key={key} title={`${icon} ${label}`} content={extraction[key]} />
      ))}
    </div>
  );
}

function SectionBlock({ title, content }: { title: string; content: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const applyStyle = useCallback(
    (cmd: 'bold' | 'hiliteColor', value?: string) => {
      if (!focused) return;
      // 恢复选区以应用样式
      document.execCommand(cmd, false, value);
      ref.current?.focus();
    },
    [focused],
  );

  const renderMarkdown = (md: string): string => {
    // 简单 Markdown → HTML（加粗、标题、列表、分隔线）
    let html = md
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    return html;
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-xl)',
    marginBottom: 'var(--space-lg)',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 'var(--text-base)',
    fontWeight: 600,
    color: 'var(--color-text)',
    marginBottom: 'var(--space-md)',
    paddingBottom: 'var(--space-sm)',
    borderBottom: '1px solid var(--color-border)',
  };

  const contentStyle: React.CSSProperties = {
    fontSize: 'var(--text-sm)',
    lineHeight: 1.8,
    color: 'var(--color-text)',
    outline: 'none',
    minHeight: 60,
  };

  return (
    <div style={cardStyle}>
      <div style={titleStyle}>{title}</div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={contentStyle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
      />
      {focused && (
        <AnnotationToolbar
          onBold={() => applyStyle('bold')}
          onHighlight={() => applyStyle('hiliteColor', '#FFF3B0')}
        />
      )}
    </div>
  );
}
