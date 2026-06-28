---
name: completed-features
description: 已完成功能清单和对应 commit
metadata:
  type: project
---

## 近期提交（文献分析模块）

| Commit | 功能 |
|--------|------|
| `ae538fb` | Excel 导出优化：文件名用蛋白名 + 富文本加粗/板块色字体 |
| `66f29ba` | 汇总表 Markdown 残留修复 + 数值高亮 + 多格同时展开 |
| `9c12647` | ArticleSummaryPage 懒加载 — 隔离 xlsx 防影响文献提交页 |
| `b47e18b` | 高亮框圆角 6px + 颜色提亮至淡莫兰迪色系 |
| `183c22a` | 方案C高亮 — DeepSeek 自主标记 + 正则兜底 + 四板块莫兰迪分色 |
| `18863e6` | 文献结果界面优化 — marked 渲染 + 数值高亮 + Excel 导出 + DeepSeek 摘要 |
| `8710022` | 文献分析页重新上传按钮 + 搜索缓存过期检测修复 |
| `0e2f73d` | 多文件夹工作区 — 前端+后端双仓库 |
| `1d0f64c` | PDB 表格文献列显示论文标题 + 传至 article-search 页面 |
| `ad35ba7` | 文献自动匹配验证 — DeepSeek 核对 DOI/PDB/UniProt |
| `496e3f9` | PDF 上传手动提交 + IndexedDB 跨刷新保留 + 提取后自动清理 |
| `68ac3e9` | 历史缓存修复 + 分析列 DOI 合并 + 多 PDB 传参 + DeepSeek 合并调用 |
| `e2afe56` | article-search 自动缓存 — 同 doi+uniprot 不重复提取，上限 50 条 |
| `a45a602` | **article-search 模块启动** — PDF 上传 + DeepSeek 提取 + 可编辑标注 + 汇总对比 |

## 早期提交（蛋白搜索基础）

| Commit | 功能 |
|--------|------|
| `9e3b59e` | 蛋白信息栏：简称放前、全称放括号 |
| `1e55985` | 下拉菜单外部关闭 + 搜索历史缓存恢复 |
| `08fffa3` | searchPdbByUniprot catch 保护 |
| `e37f205` | 区分无 X-ray 结构与获取失败 + 配体分类白名单重构 |
| `9116a24` | 完整 UniProt 物种映射表 — 27,950 个物种助记码 |
| `7c972b8` | UniProt 默认排序 + Swiss-Prot 优先 + 物种标签预计算 |

## 当前状态

- **protein-search**: 功能完整 — 搜索 → 选蛋白 → PDB 表格（配体分类/排序/DOI 合并）
- **article-search**: 功能完整 — PDF 上传 → DeepSeek 提取 → 汇总对比 → Excel 导出
- 两个模块通过 URL 参数串联（PdbResultTable "分析" 按钮 → ArticleSearchPage）
