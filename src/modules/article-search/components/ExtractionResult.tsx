import { useCallback, useRef, useState } from 'react';
import type { ArticleExtraction, ExtractionSectionKey } from '../../shared/types';
import { AnnotationToolbar } from './AnnotationToolbar';
import { renderMarkdown, stripSummaryLines } from '../../shared/utils/markdown';

const SECTIONS: Array<{ key: ExtractionSectionKey; label: string }> = [
  { key: 'construct', label: '蛋白构建' },
  { key: 'expression', label: '表达' },
  { key: 'purification', label: '纯化' },
  { key: 'crystallization', label: '结晶' },
];

interface ExtractionResultProps {
  extraction: ArticleExtraction;
}

export function ExtractionResult({ extraction }: ExtractionResultProps) {
  return (
    <div>
      {SECTIONS.map(({ key, label }) => (
        <SectionBlock key={key} title={label} content={extraction[key]} sectionKey={key} />
      ))}
    </div>
  );
}

function SectionBlock({ title, content, sectionKey }: { title: string; content: string; sectionKey: string }) {
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
        className="md-content"
        contentEditable
        suppressContentEditableWarning
        style={contentStyle}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        dangerouslySetInnerHTML={{ __html: renderMarkdown(stripSummaryLines(content), sectionKey) }}
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
