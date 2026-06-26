---
name: tech-decisions
description: 关键技术选型和架构决策
metadata:
  type: project
---

- **React + TypeScript + Vite**: Claude 最熟悉，生态成熟
- **纯前端**: UniProt/RCSB API 均支持 CORS `*`，确认可行
- **模块隔离**: protein-search / article-search / shared 三层
- **@tanstack/react-table**: 排序、筛选、行合并（配体列需要）
- **localStorage**: 搜索历史持久化，单用户够用
- **配体排序**: 无抑制剂 > 天然辅因子 > 有抑制剂 > 未知（结晶/缓冲液忽略）
- **防抖 400ms**: UniProt 搜索候选下拉

**Why:** 已验证所有技术可行性后做出的最小化选型。
**How to apply:** 不改技术栈除非有强需求。
