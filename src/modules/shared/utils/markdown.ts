import { marked } from 'marked';

/** 四板块柔和莫兰迪色 */
const HIGHLIGHT_CLASSES: Record<string, string> = {
  construct: 'hl-construct',
  expression: 'hl-expression',
  purification: 'hl-purification',
  crystallization: 'hl-crystallization',
};

/** 注入页面的颜色 CSS */
const HIGHLIGHT_CSS = `
.hl-construct { background: #E6ECF5; padding: 1px 3px; border-radius: 6px; }
.hl-expression { background: #E6F4E6; padding: 1px 3px; border-radius: 6px; }
.hl-purification { background: #F6EFE8; padding: 1px 3px; border-radius: 6px; }
.hl-crystallization { background: #EFEAF5; padding: 1px 3px; border-radius: 6px; }
`;

/** 各级标题样式：小标题（h3）加粗且字号大一级，二级标题（h4）加粗 */
const HEADING_CSS = `
.md-content h3 { font-size: 1.15em; font-weight: 700; margin: 1em 0 0.4em; color: var(--color-text); }
.md-content h4 { font-size: 1em; font-weight: 700; margin: 0.8em 0 0.3em; color: var(--color-text); }
.md-content h2 { font-size: 1.2em; font-weight: 700; margin: 1.2em 0 0.5em; color: var(--color-text); }
.md-content strong { font-weight: 700; }
`;

/** 正则兜底模式 — 匹配标准实验数值并用 ** 包裹 */
const FALLBACK_PATTERNS: Array<[RegExp, string]> = [
  // 温度: 4°C, 37°C, 100 K
  [/(\d+(?:\.\d+)?\s*°C)/g, '**$1**'],
  [/(\d+(?:\.\d+)?\s*K)\b/g, '**$1**'],
  // 浓度: 50 mM, 0.5 mg/mL, 5% (v/v)
  [/(\d+(?:\.\d+)?\s*(?:mM|μM|nM|mg\/mL|μg\/mL|ng\/mL|g\/L|%(?:\s*\([vw]\/[vw]\))?))/g, '**$1**'],
  // pH: pH 7.5, pH 8.0-8.5
  [/(pH\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?)/gi, '**$1**'],
  // 转速/离心力: 200 rpm, 12000 × g
  [/(\d+(?:,\d{3})*(?:\.\d+)?\s*(?:rpm|×\s*g))/g, '**$1**'],
  // OD₆₀₀
  [/(OD[₆6]00\s*(?:=\s*)?\d+(?:\.\d+)?)/gi, '**$1**'],
  // IPTG 浓度
  [/(\d+(?:\.\d+)?\s*(?:mM|μM)\s*IPTG)/gi, '**$1**'],
  // 体积
  [/(\d+(?:\.\d+)?\s*(?:mL|μL|L))\b/g, '**$1**'],
  // 时间
  [/(\d+(?:\.\d+)?\s*(?:h|min|hour|minute)s?)\b/g, '**$1**'],
];

/** 渲染 Markdown → HTML，自动高亮关键数值 */
export function renderMarkdown(md: string, section?: string): string {
  if (!md?.trim()) return '';

  // 1. 正则兜底：在非 ** 区域补标已知模式（避免重复标记 DeepSeek 已标的）
  const segments = md.split(/(\*\*.*?\*\*)/g);
  for (let i = 0; i < segments.length; i += 2) {
    for (const [pattern, replacement] of FALLBACK_PATTERNS) {
      segments[i] = segments[i].replace(pattern, replacement);
    }
  }
  const preHighlighted = segments.join('');

  // 2. Markdown → HTML
  let html = marked.parse(preHighlighted, { breaks: true }) as string;

  // 3. <strong> → 板块色 span（只对含数值的高亮；纯文字标题保持原生加粗）
  const cls = HIGHLIGHT_CLASSES[section || ''] || 'hl-construct';
  html = html.replace(
    /<strong>(.*?)<\/strong>/g,
    (_full: string, text: string) => {
      if (/\d/.test(text)) {
        return `<span class="${cls}">${text}</span>`;
      }
      return `<strong>${text}</strong>`;
    },
  );

  // 4. 注入颜色 CSS + 标题样式
  return `<style>${HIGHLIGHT_CSS}${HEADING_CSS}</style>${html}`;
}

/** 移除 Markdown 标记，返回纯文本（用于 Excel 导出） */
export function stripMarkdown(md: string): string {
  if (!md) return '';
  return md
    .replace(/^#{1,4}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^- (.+)$/gm, '• $1')
    .replace(/^---$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 「关键摘要」行匹配（捕获组 = 摘要文本；前缀匹配，CRLF 安全） */
const SUMMARY_LINE_RE = /^\s*\*{0,2}关键摘要[:：]\*{0,2}\s*(.*)$/;

/** 摘除板块内容里残留的「关键摘要」行（历史缓存兜底；摘要只应存在于 summaries 字段） */
export function stripSummaryLines(content: string): string {
  if (!content) return '';
  return content
    .split('\n')
    .filter((l) => !SUMMARY_LINE_RE.test(l))
    .join('\n')
    .trim();
}

/** 从板块内容里摘出「关键摘要」行的文本（旧缓存无 summaries 字段时兜底） */
export function extractSummaryLine(content: string): string {
  if (!content) return '';
  for (const line of content.split('\n')) {
    const m = SUMMARY_LINE_RE.exec(line);
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

/** 从 Markdown 提取前 N 个词的预览文本 */
export function previewText(md: string, maxWords = 12): string {
  const plain = stripMarkdown(md);
  const words = plain.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return plain;
  return words.slice(0, maxWords).join(' ') + '...';
}
