---
name: tech-decisions
description: 关键技术选型和架构决策
metadata:
  type: project
---

## 前端

- **React 19 + TypeScript + Vite**: 纯前端 SPA，HashRouter
- **模块隔离**: `protein-search/` / `article-search/` / `shared/` 三层
- **@tanstack/react-table**: 排序、筛选、DOI 行合并
- **xlsx (SheetJS)**: Excel 导出，用 OOXML `<si>` 富文本实现加粗+板块色
- **marked**: Markdown 渲染（ExtractionResult 组件）
- **localStorage**: 搜索历史、文献提取缓存（最多50条）、汇总条目
- **IndexedDB**: PDF 文件跨刷新保留（pdfFileCache）
- **防抖 400ms**: UniProt 搜索候选下拉

## 后端（独立仓库）

- **Python FastAPI** (端口 8765): `POST /api/extract` PDF 文本提取
- **DeepSeek API**: `deepseek-v4-flash`, temperature 0.1, max_tokens 16384
- **PyMuPDF (fitz)**: PDF 文本提取
- 调用链路: PDF → 正则截取 Methods 章节 → SYSTEM_PROMPT + COMBINED_PROMPT → DeepSeek → JSON 解析
- 后端仓库: `D:\vscode_claudecode_related\article-search-backend\`

## API 直调

- **UniProt REST API**: `https://rest.uniprot.org/uniprotkb/` — 搜索 + 详情（辅因子）
- **RCSB Search API v2**: `https://search.rcsb.org/rcsbsearch/v2/` — PDB 查询
- **RCSB Data API**: `https://data.rcsb.org/redoc/index.html` — 批量获取结构详情

## 关键设计决策

- **配体分类**: 白名单排除法 — NATIVE_LIGANDS/BACKGROUND_LIGANDS 白名单 + binding affinity 数据，不在白名单的一律视为 inhibitor
- **PDB 排序**: apo(0) > holo_cofactor(1) > inhibited(2)，同优先级按 DOI 字母序
- **proteinName 链路**: UniProtCandidate.name → URL params → localStorage → Excel 文件名
- **DeepSeek 一次调用**: 四个板块 + 验证 + 摘要合并到一次 API 调用，节省 token
- **Excel 富文本**: 用 `<si><r><rPr>` OOXML 格式实现加粗+深色字体，不用背景色（Excel 不支持逐段 `<shd>`）

**Why:** 已验证所有技术可行性后做出的最小化选型。
**How to apply:** 不改技术栈除非有强需求。新功能优先复用现有服务层。
