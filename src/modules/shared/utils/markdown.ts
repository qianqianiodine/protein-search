import { marked } from 'marked';

/** 需要高亮的实验关键数值 */
const HIGHLIGHT_PATTERNS: Array<[RegExp, string]> = [
  // 温度: 4°C, 37°C, 100 K
  [/\d+(?:\.\d+)?\s*°C/g, '<mark>$&</mark>'],
  [/\d+(?:\.\d+)?\s*K\b/g, '<mark>$&</mark>'],
  // 浓度: 50 mM, 0.5 mg/mL, 5% (v/v)
  [/\d+(?:\.\d+)?\s*(?:mM|μM|nM|mg\/mL|μg\/mL|ng\/mL|g\/L|%(?:\s*\([vw]\/[vw]\))?)/g, '<mark>$&</mark>'],
  // pH: pH 7.5, pH 8.0-8.5
  [/pH\s*\d+(?:\.\d+)?(?:\s*[-–—]\s*\d+(?:\.\d+)?)?/gi, '<mark>$&</mark>'],
  // 转速/离心力: 200 rpm, 12000 × g
  [/\d+(?:,\d{3})*(?:\.\d+)?\s*(?:rpm|×\s*g)/g, '<mark>$&</mark>'],
];

/** 渲染 Markdown → HTML，自动高亮关键数值 */
export function renderMarkdown(md: string): string {
  if (!md?.trim()) return '';
  let html = marked.parse(md, { breaks: true }) as string;
  for (const [pattern, replacement] of HIGHLIGHT_PATTERNS) {
    html = html.replace(pattern, replacement);
  }
  return html;
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
