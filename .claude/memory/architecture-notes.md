---
name: architecture-notes
description: 核心架构知识：数据流、API 模式、Excel 导出、配体分类、排序逻辑
metadata:
  type: project
---

## proteinName 数据链路

```
UniProtCandidate.name
  → PdbResultTable: URL params ?proteinName=xxx
  → ArticleSearchPage: 读 params → saveArticleExtraction + addToSummary
  → localStorage (SummaryEntry.proteinName + ArticleHistoryEntry.proteinName)
  → ArticleSummaryPage: Excel 文件名降级链 proteinName → uniprot → pdbId → '未知蛋白'
```

向后兼容：旧缓存无 proteinName 字段时自动降级。

## Excel 富文本导出

核心：xlsx 支持 `{ t: 's', v: plainText, r: '<si>...</si>' }` cell 对象，用于 OOXML shared strings。

必须用 `XLSX.utils.aoa_to_sheet()` 而非 `json_to_sheet`（后者不支持 cell 对象）。

板块颜色映射（Excel 不支持逐段背景色 `<shd>`，折中用深色字体）：
| 板块 | 字体色 |
|------|--------|
| construct | `FF4A6A8A` |
| expression | `FF3A6B3A` |
| purification | `FF8A6A4A` |
| crystallization | `FF6A4A8A` |

markdownToRichXml 流程：`split(/(\*\*.*?\*\*)/g)` → 普通段 → `<r><t>` / 加粗段 → `<r><rPr><b/>...</rPr><t>` / 含数字加粗 → 追加 `<color rgb="FF${color}"/>`

## 后端文献提取

调用链：PDF → PyMuPDF 全文 → 正则截 Methods 章节 → SYSTEM_PROMPT + COMBINED_PROMPT + 文本 → DeepSeek API（一次调用，temperature 0.1, max_tokens 16384）

Token 典型消耗：输入 ~6,500（含 ~290 SYSTEM + ~2,350 COMBINED + 3-5K PDF），输出 ~3,000。单篇费用约 $0.0018。

## 配体分类（ligand-classification.ts）

四层优先级（白名单排除法）：
1. NATIVE_LIGANDS (~200条目) → cofactor
2. BACKGROUND_LIGANDS (~100条目) → crystal
3. bindingAffinityCompIds 命中 → inhibitor
4. 其余 → inhibitor

两类白名单互有重叠（如 ZN/MG 在 NATIVE 也在 BACKGROUND），NATIVE 优先。

## PDB 排序（tableSortUtils.ts）

三级：apo(0) > holo_cofactor(1) > inhibited(2)

crystal 分类配体被过滤，不影响排序。同优先级按 DOI 字母序，无 DOI 排最后。
