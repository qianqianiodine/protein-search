# Protein Structure Search — 项目指令

## 项目概述
蛋白结构信息检索和整理工具。分两个模块：
- **protein-search**: UniProt 搜索 → RCSB PDB 结构查看 → 配体分类
- **article-search**: PDF 上传 → DeepSeek 提取 → 汇总对比 → Excel 导出

## 技术栈
- React 19 + TypeScript + Vite
- react-router-dom (路由)
- @tanstack/react-table (表格)
- xlsx (SheetJS) — Excel 富文本导出
- marked — Markdown 渲染
- localStorage (搜索历史/文献缓存/汇总) + IndexedDB (PDF 缓存)
- 前端直调 UniProt / RCSB PDB REST API
- Python FastAPI 后端 (端口 8765) + DeepSeek API (deepseek-v4-flash)

## 目录结构
```
src/modules/
  protein-search/   ← 蛋白搜索 (核心)
  article-search/   ← 文献分析
  shared/           ← 共享类型/组件/服务
```
后端独立仓库: `D:\vscode_claudecode_related\article-search-backend\`

## 关键规则
- 新增蛋白搜索功能 → 优先改 `protein-search/`
- 新增文献分析功能 → 优先改 `article-search/`
- 通用组件/服务 → `shared/`
- UI 组件不写死业务逻辑
- 每完成一个切片 → git commit
- API 优先，不优先写网页爬虫
- 配体分类规则见 `protein-search/config/ligand-classification.ts`

## API 文档
- UniProt REST: https://rest.uniprot.org/uniprotkb/
- RCSB Search API v2: https://search.rcsb.org/rcsbsearch/v2/
- RCSB Data API: https://data.rcsb.org/redoc/index.html

## 持久记忆 —— 读它们、遵守它们

本项目把持久知识放在 `.claude/memory/`：

- `memory.md` —— 稳定事实（结果 / ID / 配置 / 决策）
- `wiki.md` —— 共享约定 & 偏好
- `learnings.md` —— 被纠正过的坑（只追加；临时任务不要写进去）

一个 SessionStart hook 会在每个 session 开头自动注入它们。**动手前先读。**
它们反映写下时的情况 —— 任何关键信息（路径 / ID / flag）依赖前先核实是否还成立。

每个 substantive 任务结束前，**回写**：
- 新被纠正的坑 → 追加到 `learnings.md`（带日期、最新在上、绝不改写）
- 新事实 / 结果 / ID / 配置 → 更新 `memory.md`（覆盖过时的）
- 新共享约定 / 偏好 → 更新 `wiki.md`
- 临时任务、一次性信息 → **不要写进任何记忆文件**（会污染决策）
- 没有任何 durable 的东西 → 说一句"无新记忆"，别默默跳过
