---
name: key-files-map
description: 关键文件路径 + 职责 — 快速定位要改的文件
metadata:
  type: project
---

## 类型系统
- `src/modules/shared/types/index.ts` — 所有 TS 类型定义（UniProtCandidate, PdbStructure, ArticleExtraction, SummaryEntry 等）

## 蛋白搜索
- `src/modules/protein-search/pages/ProteinSearchPage.tsx` — 搜索主页
- `src/modules/protein-search/components/SearchBar.tsx` — 搜索框 + UniProt 自动补全
- `src/modules/protein-search/components/UniProtSuggestions.tsx` — 候选项下拉
- `src/modules/protein-search/components/PdbResultTable.tsx` — PDB 结构表格（类型/PDB/结构/文献/配体/分析）
- `src/modules/protein-search/components/LigandCell.tsx` — 配体展示单元
- `src/modules/protein-search/components/HistoryDrawer.tsx` — 搜索历史抽屉
- `src/modules/protein-search/services/uniprotService.ts` — UniProt REST API
- `src/modules/protein-search/services/rcsbService.ts` — RCSB PDB API
- `src/modules/protein-search/services/searchHistoryService.ts` — localStorage 历史 CRUD
- `src/modules/protein-search/services/speciesCodes.ts` — 物种助记码映射（27,950 条目）
- `src/modules/protein-search/config/ligand-classification.ts` — 配体四层分类规则
- `src/modules/protein-search/utils/tableSortUtils.ts` — PDB 三级排序

## 文献分析
- `src/modules/article-search/pages/ArticleSearchPage.tsx` — PDF 上传 + DeepSeek 提取 + 加入汇总
- `src/modules/article-search/pages/ArticleSummaryPage.tsx` — 汇总对比表 + Excel 导出（富文本）
- `src/modules/article-search/components/PdfUploader.tsx` — PDF 拖拽上传
- `src/modules/article-search/components/ExtractionResult.tsx` — 提取结果四板块展示
- `src/modules/article-search/services/extractionService.ts` — 调后端 /api/extract
- `src/modules/article-search/services/summaryStorage.ts` — localStorage 汇总 CRUD
- `src/modules/article-search/services/articleHistoryService.ts` — localStorage 提取历史缓存
- `src/modules/article-search/services/pdfFileCache.ts` — IndexedDB PDF 缓存

## 共享
- `src/modules/shared/utils/markdown.ts` — marked 渲染 + stripMarkdown
- `src/modules/shared/services/api.ts` — HTTP 请求封装

## 后端（独立仓库 `D:\vscode_claudecode_related\article-search-backend\`）
- `server.py` — FastAPI 主服务 (端口 8765, POST /api/extract)
- `deepseek_client.py` — DeepSeek API 客户端配置
- `prompts.py` — SYSTEM_PROMPT + COMBINED_PROMPT 模板
