# Protein Structure Search — 项目指令

## 项目概述
蛋白结构信息检索和整理工具。分两个模块：
- **protein-search**: UniProt 搜索 → RCSB PDB 结构查看 → 配体分类
- **article-search**: 文献分析（当前占位）

## 技术栈
- React 19 + TypeScript + Vite
- react-router-dom (路由)
- @tanstack/react-table (表格)
- localStorage (搜索历史)
- 纯前端，直调 UniProt / RCSB PDB REST API

## 目录结构
```
src/modules/
  protein-search/   ← 蛋白搜索 (核心)
  article-search/   ← 文献分析 (占位)
  shared/           ← 共享类型/组件/服务
```

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
