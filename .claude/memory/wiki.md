# Wiki — 共享约定 & 偏好

> 项目特有的约定和偏好。全局设置（沟通/环境/安全/Karpathy 原则）见全局 CLAUDE.md，不在此重复。

## 项目约定
- 每完成一个功能切片 → 立即 git commit，不等提醒
- API 优先，不写网页爬虫
- UI 组件不写死业务逻辑
- 新增蛋白搜索功能 → `protein-search/`
- 新增文献分析功能 → `article-search/`
- 通用组件/服务 → `shared/`

## 开发流程
- 代码修改后自动重启 Vite dev server（杀旧进程 + 重启，固定端口优先 5173）
- 编译验证 + dev server 确认后再提交
- **每次修改完、杀完进程后，必须给出可访问的 URL**（前端 http://localhost:5173，后端 http://127.0.0.1:8765）

## 记忆维护
- 每个 substantive 任务收尾前回写 memory
- 临时任务/一次性信息不写入记忆（会污染决策）
