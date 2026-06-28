# Protein Structure Search — 蛋白结构搜索 & 文献分析

一个面向结构生物学的信息检索工具，分两大模块：

- **蛋白搜索** — 通过蛋白名称/基因名/UniProt ID 搜索，自动关联 PDB 结构，展示配体分类
- **文献分析** — 上传 PDF 论文，AI 自动提取蛋白构建/表达/纯化/结晶方法，支持多篇汇总对比和 Excel 导出

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 19 + TypeScript + Vite |
| 路由 | react-router-dom |
| 表格 | @tanstack/react-table |
| Markdown | marked |
| Excel 导出 | xlsx (SheetJS) |
| 后端 | Python FastAPI + uvicorn |
| AI 提取 | OpenAI 兼容 API（DeepSeek / OpenAI / 任意兼容 provider） |
| PDF 解析 | PyMuPDF |

---

## 前提条件

- **Node.js** 18+（前端）
- **Python** 3.10+（仅文献分析模块需要，蛋白搜索不需要）

---

## 快速开始

### 1. 前端（蛋白搜索 + 文献分析页面）

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

前端启动后，蛋白搜索功能即可使用——**不需要任何 API Key**。

### 2. 后端（仅文献分析的 AI 提取需要）

后端代码在独立仓库 `article-search-backend/`，建议放在与本项目同级的目录：

```
protein-search/          ← 本项目（前端）
article-search-backend/  ← 后端
```

```bash
cd ../article-search-backend

# 安装 Python 依赖
pip install -r requirements.txt

# 配置 API Key（见下一节）
cp .env.example .env
# 编辑 .env，填入你的 API Key

# 启动后端（默认 http://127.0.0.1:8765）
python server.py
```

前端 Vite 开发服务器会自动把 `/api/*` 请求代理到后端 `127.0.0.1:8765`。

---

## API Key 配置

### 蛋白搜索 → 不需要 API Key

UniProt 和 RCSB PDB 都是公开免费 API，零配置即可使用。

### 文献分析 → 需要 LLM API Key

后端使用 **OpenAI 兼容 SDK**，支持任何 OpenAI 格式的 API provider。在 `article-search-backend/` 下创建 `.env` 文件，配置以下三个变量：

| 变量 | 必填 | 说明 | 默认值 |
|------|------|------|--------|
| `DEEPSEEK_API_KEY` | ✅ 是 | LLM API Key | 无 |
| `DEEPSEEK_BASE_URL` | 否 | API 地址 | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL` | 否 | 模型名 | `deepseek-v4-flash` |

### 不同 provider 的配置示例

**.env.example**（随项目提供）：

```bash
# === 必填：你的 LLM API Key ===
DEEPSEEK_API_KEY=your-api-key-here

# === 可选：API 地址（选一个取消注释）===

# 方式 1：DeepSeek（默认，无需改）
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash

# 方式 2：OpenAI
# DEEPSEEK_BASE_URL=https://api.openai.com/v1
# DEEPSEEK_MODEL=gpt-4o

# 方式 3：其他 OpenAI 兼容 provider（Together AI / Groq / 本地 Ollama 等）
# DEEPSEEK_BASE_URL=https://api.together.xyz/v1
# DEEPSEEK_MODEL=meta-llama/Llama-3-70b-chat-hf

# 方式 4：本地 Ollama
# DEEPSEEK_BASE_URL=http://localhost:11434/v1
# DEEPSEEK_MODEL=qwen2.5:7b
```

> **注意**：变量名虽然叫 `DEEPSEEK_`，但因为用的是 OpenAI 兼容协议，换成任何 provider 都能用。只需要改 `BASE_URL` 和 `MODEL`。

### 获取 API Key

| Provider | 注册地址 | 价格参考 |
|----------|----------|----------|
| DeepSeek | https://platform.deepseek.com | ¥1/百万 token |
| OpenAI | https://platform.openai.com | $2.5-15/百万 token |
| Together AI | https://api.together.ai | $0.2-3/百万 token |

---

## 项目结构

```
protein-search/
├── src/modules/
│   ├── protein-search/        ← 蛋白搜索（核心模块）
│   │   ├── pages/             # 主页面
│   │   ├── components/        # SearchBar / PDB 表格 / 配体标记 / 历史
│   │   ├── services/          # UniProt API / RCSB API / 历史持久化
│   │   ├── config/            # 配体分类规则
│   │   └── utils/             # 表格排序
│   ├── article-search/        ← 文献分析（需要后端）
│   │   ├── pages/             # PDF 上传页 / 汇总对比页
│   │   ├── components/        # PDF 拖拽上传 / 提取结果 / 标注工具
│   │   └── services/          # 提取请求 / 历史 / 汇总存储 / PDF 缓存
│   └── shared/                ← 共享
│       ├── types/             # TypeScript 类型定义
│       ├── services/          # 通用 fetch 封装
│       └── utils/             # Markdown 渲染
├── vite.config.ts             # Vite 配置（含 /api 代理）
└── package.json

article-search-backend/        ← 文献分析后端（独立仓库）
├── server.py                  # FastAPI 入口（端口 8765）
├── deepseek_client.py         # LLM 客户端（OpenAI 兼容）
├── mineru_runner.py           # PDF 文本提取（PyMuPDF）
├── prompts.py                 # 提取提示词
├── requirements.txt           # Python 依赖
└── .env                       # API Key 配置（不入 git）
```

---

## 架构

```
浏览器 (localhost:5173)
    │
    ├── UniProt REST API ──────────── 公开、无需 Key
    ├── RCSB PDB REST/GraphQL API ─── 公开、无需 Key
    │
    └── /api/extract ──→ Vite 代理 ──→ FastAPI (localhost:8765)
                                            │
                                       PyMuPDF 提取文本
                                            │
                                       OpenAI 兼容 LLM
                                       (DeepSeek/OpenAI/...)
                                            │
                                       JSON 结构化提取结果
```

- **蛋白搜索**：纯前端，浏览器直调 UniProt + RCSB PDB，无后端依赖
- **文献分析**：前端上传 PDF → 后端提取文本 → LLM 解析 → 前端展示
- **数据持久化**：全部 localStorage + IndexedDB（浏览器端），无数据库依赖

---

## 常见问题

**Q: 只做蛋白搜索，需要装后端吗？**  
不需要。蛋白搜索完全在前端运行，直接调用公开 API。

**Q: 可以用 ChatGPT / 其他模型吗？**  
可以。后端用 OpenAI 兼容协议，改 `.env` 里的 `DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL` 即可。见上方配置示例。

**Q: PDF 提取支持什么格式？**  
基于文本的 PDF（非扫描件）。扫描件会报错提示无文本内容。
