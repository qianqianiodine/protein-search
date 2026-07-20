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
| PDF 解析 | PyMuPDF + python-docx |

---

## 前提条件

- **Node.js** 18+（[下载](https://nodejs.org/)）
- **Python** 3.10+（系统自带 / [Conda](https://docs.conda.io/) / 官网安装均可）
- **大模型 API Key**（仅文献分析模块需要，蛋白搜索不需要）

---

## 快速开始

### 第一步：下载代码

**方式 A — Git 克隆（推荐）：**

```bash
git clone https://github.com/qianqianiodine/protein-search.git
cd protein-search
```

**方式 B — 下载 ZIP：**

点击 [GitHub 页面](https://github.com/qianqianiodine/protein-search) 上的绿色 **Code** 按钮 → **Download ZIP** → 解压到你想要的目录 → 进入目录。

### 第二步：配置大模型 API Key（仅文献分析需要）

用记事本（或任意编辑器）打开 `backend\.env`，把 `your-api-key-here` 替换成你的真实 API Key。

> 如果你**只使用蛋白搜索功能**，这一步可以跳过。

### 第三步：启动

**Windows：** 双击 `start.bat`

**Mac / Linux：** 终端运行 `bash start.sh`

脚本会自动：检测 Python/Node.js → 安装依赖 → 启动后端(:8765)和前端(:5173)。

浏览器打开 `http://localhost:5173` 即可使用。

> 如果脚本报错，也可以参考下面的手动启动方式。

### 手动启动（如果脚本不工作）

```bash
# 终端 1 — 启动后端
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt   # Windows
# .venv/bin/pip install -r requirements.txt     # Mac/Linux
.venv\Scripts\python server.py                   # Windows
# .venv/bin/python server.py                     # Mac/Linux

# 终端 2 — 启动前端
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

---

## API Key 配置

### 蛋白搜索 → 不需要 API Key

UniProt 和 RCSB PDB 都是公开免费 API，零配置即可使用。

### 文献分析 → 需要 LLM API Key

编辑 `backend/.env`，填入你的 API Key：

```bash
# 必填
DEEPSEEK_API_KEY=your-api-key-here

# 可选：切换模型提供商（取消注释你要用的那组）
DEEPSEEK_BASE_URL=https://api.deepseek.com      # 默认 DeepSeek
DEEPSEEK_MODEL=deepseek-v4-flash
```

支持的提供商：

| 提供商 | 获取 Key | 价格参考 |
|--------|----------|----------|
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) | ¥1/百万 token |
| 通义千问 Qwen | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com/) | ¥0.8-2/百万 token |
| Kimi | [platform.moonshot.cn](https://platform.moonshot.cn/) | ¥1-12/百万 token |
| GLM（智谱） | [open.bigmodel.cn](https://open.bigmodel.cn/) | ¥0.1-5/百万 token |
| 豆包（字节） | [console.volcengine.com/ark](https://console.volcengine.com/ark/) | ¥0.8-4/百万 token |
| OpenAI | [platform.openai.com](https://platform.openai.com) | $2.5-15/百万 token |
| Gemini | [aistudio.google.com](https://aistudio.google.com/) | 免费额度可用 |
| Ollama（本地） | [ollama.com](https://ollama.com) | 免费 |

> 变量名虽然叫 `DEEPSEEK_`，但因为用的是 OpenAI 兼容协议，换成任何 provider 都能用。只需改 `BASE_URL` 和 `MODEL`。

---

## 项目结构

```
protein-search/
├── backend/                       ← Python 后端（FastAPI + 大模型调用）
│   ├── server.py                  ← API 入口（端口 8765）
│   ├── deepseek_client.py         ← LLM 客户端（OpenAI 兼容）
│   ├── document_reader.py         ← PDF/DOCX 文本提取
│   ├── prompts.py                 ← 提取提示词
│   ├── requirements.txt           ← Python 依赖
│   ├── .env.example               ← API Key 配置模板
│   └── .gitignore
├── src/modules/
│   ├── protein-search/            ← 蛋白搜索（核心模块）
│   │   ├── pages/                 # 主页面
│   │   ├── components/            # SearchBar / PDB 表格 / 配体标记 / 历史
│   │   ├── services/              # UniProt API / RCSB API / 历史持久化
│   │   ├── config/                # 配体分类规则
│   │   └── utils/                 # 表格排序
│   ├── article-search/            ← 文献分析（需要后端）
│   │   ├── pages/                 # PDF 上传页 / 汇总对比页
│   │   ├── components/            # PDF 拖拽上传 / 提取结果
│   │   └── services/              # 提取请求 / 历史 / 汇总存储 / PDF 缓存
│   └── shared/                    ← 共享
│       ├── types/                 # TypeScript 类型定义
│       ├── services/              # 通用 fetch 封装
│       └── utils/                 # Markdown 渲染
├── start.bat                      ← Windows 一键启动
├── start.sh                       ← Mac/Linux 一键启动
├── vite.config.ts                 # Vite 配置（含 /api 代理）
└── package.json
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
                                       (DeepSeek/OpenAI/Ollama/...)
                                            │
                                       JSON 结构化提取结果
```

- **蛋白搜索**：纯前端，浏览器直调 UniProt + RCSB PDB，无后端依赖
- **文献分析**：前端上传 PDF → 后端提取文本 → LLM 解析 → 前端展示
- **数据持久化**：全部 localStorage + IndexedDB（浏览器端），无数据库依赖

---

## 常见问题

**Q: 启动脚本运行报错？**
A: 确认已安装 Node.js 18+ 和 Python 3.10+，且命令 `node` 和 `python`（或 `python3`）在系统 PATH 中。

**Q: 只做蛋白搜索，需要装后端吗？**
A: 不需要。蛋白搜索完全在前端运行，直接调用公开 API。启动脚本检测到缺少 Python 也会跳过。

**Q: 可以用 ChatGPT / 其他模型吗？**
A: 可以。后端用 OpenAI 兼容协议，改 `backend/.env` 里的 `DEEPSEEK_BASE_URL` 和 `DEEPSEEK_MODEL` 即可。

**Q: PDF 提取支持什么格式？**
A: 基于文本的 PDF 和 DOCX。扫描件 PDF 会报错提示无文本内容。
