# Wiki — 共享约定 & 偏好

> 持久的用户偏好和项目约定。稳定；手动或由 agent 维护。

## 沟通
- 全部用中文沟通

## 环境
- Windows 10，用 Git Bash 运行命令
- 没有系统级 Python，Python 走 Anaconda（`D:\anaconda3`）

## 安全
- 主动告知操作风险

## 编程行为准则（Andrej Karpathy 原则）
- 编码前先思考，明确假设，不确定先问
- 简单优先，不写推测性代码，不为一次性使用创建抽象
- 精准改动，不擅自重构或改进相邻代码，匹配现有风格
- 目标驱动执行，定义可验证的成功标准

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

## 记忆维护
- 新项目/首次接触已有项目 → 先检查 `.claude/memory/` 是否按 claude-memory skill 规范设置
- 每次 substantive 任务结束前回写 memory
- 临时任务/一次性信息不写入记忆（会污染决策）
