# Memory — 稳定事实

> 持久事实：结果、ID、配置、决策。事实变了就覆盖。

## 项目定位
- Protein Structure Search — 蛋白结构信息检索和整理 Web 应用
- 用户：结构生物学/药物化学研究者，单人本地使用
- 核心目标：快速判定哪些 PDB 结构是无外来抑制剂的 apo 参考结构

## 技术栈
- **前端**: React 19 + TypeScript + Vite（纯前端 SPA，HashRouter）
- **路由**: react-router-dom — `/` 主页, `/article-search`, `/article-summary`
- **表格**: @tanstack/react-table
- **Excel**: xlsx (SheetJS)，OOXML `<si>` 富文本导出
- **Markdown**: marked 渲染 + 自定义正则数值高亮
- **存储**: localStorage（历史/缓存/汇总）+ IndexedDB（PDF 文件缓存）
- **后端**: Python FastAPI (端口 8765)，独立仓库 `D:\vscode_claudecode_related\article-search-backend\`
- **AI**: DeepSeek API — `deepseek-v4-flash`, temperature 0.1, max_tokens 16384
- **PDF**: PyMuPDF (fitz) 文本提取

## 目录结构
```
src/modules/
  protein-search/        ← 核心：components/ config/ pages/ services/ utils/
  article-search/        ← 文献：components/ pages/ services/
  shared/                ← types/, utils/markdown.ts, services/api.ts
```

## API
- UniProt REST: `https://rest.uniprot.org/uniprotkb/` — 搜索 + 详情（辅因子）
- RCSB Search API v2: `https://search.rcsb.org/rcsbsearch/v2/` — PDB 查询
- RCSB Data API: `https://data.rcsb.org/redoc/index.html` — 批量结构详情
- 后端: `POST http://localhost:8765/api/extract` — PDF 文献提取

## 后端文献提取链路
PDF → PyMuPDF 全文 → 正则截 Methods 章节（`_extract_methods_section` → 失败用 `_extract_methods_by_density` → 失败发全文）→ SYSTEM_PROMPT + COMBINED_PROMPT + PDF 文本 → DeepSeek API 一次调用 → JSON 解析

文献验证：标题优先 — 先比对 `paperTitle`，一致即输出「文献提交正确」；不一致时再用 DOI/PDB/UniProt 兜底。补充材料 PDF 不参与验证。

Token 典型消耗：输入 ~6,500，输出 ~3,000。单篇 ~$0.0018。

## 配体分类（ligand-classification.ts）
白名单排除法，四层优先级：
1. NATIVE_LIGANDS（~200条目：HEM/FAD/NAD/COA/SAM/ATP...）→ cofactor
2. BACKGROUND_LIGANDS（~100条目：TRS/MES/PEG/GOL/HOH...）→ crystal
3. bindingAffinityCompIds 命中 → inhibitor
4. 其余 → inhibitor

颜色：cofactor=#7D9DB5, inhibitor=#C49B9B, crystal=#9EAE9A

## PDB 排序（tableSortUtils.ts）
三级：apo(0) > holo_cofactor(1) > inhibited(2)。crystal 分类配体被过滤不参与排序。同优先级按 DOI 字母序。

## proteinName 数据流
UniProtCandidate.name → PdbResultTable URL params → ArticleSearchPage 读取 → localStorage（SummaryEntry + ArticleHistoryEntry）→ ArticleSummaryPage Excel 文件名。降级链: proteinName → uniprot → pdbId → '未知蛋白'。

## Excel 富文本导出
xlsx cell 对象 `{ t:'s', v:plainText, r:'<si>...</si>' }`，必须用 `aoa_to_sheet`。板块字体色: construct=FF4A6A8A, expression=FF3A6B3A, purification=FF8A6A4A, crystallization=FF6A4A8A。Excel 不支持逐段背景色。

## 已完成功能
- protein-search: UniProt 搜索 → PDB 表格（配体分类/排序/DOI合并/物种映射27,950条目）
- article-search: PDF 上传 → DeepSeek 提取 → 汇总对比 → Excel 富文本导出
- 两模块通过 PdbResultTable "分析"按钮串联
- 文献自动缓存（同 doi+uniprot 不重复，上限50条）+ 自动匹配验证
