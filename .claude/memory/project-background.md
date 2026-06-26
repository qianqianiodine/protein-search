---
name: project-background
description: 项目目标和使用场景
metadata:
  type: project
---

Protein Structure Search 是一个本地 Web 应用，帮助结构生物学/药物化学研究者：
1. 从 UniProt 搜索蛋白
2. 查看 RCSB PDB 中的晶体结构
3. 自动分类配体（天然辅因子 vs 外来抑制剂）
4. 关联文献 DOI

用户一个人本地使用，纯前端无后端。后续可能分享给同事（静态部署）。

**Why:** 用户需要快速判定哪些 PDB 结构是无外来抑制剂的 apo 参考结构。
**How to apply:** 所有功能设计围绕"快速识别结构质量"展开。
