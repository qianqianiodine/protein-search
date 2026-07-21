#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================"
echo "  Protein Structure Search — 启动中..."
echo "============================================"
echo ""

# === 检测 Python ===
PYTHON_CMD=""
if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD="python"
else
    echo "[错误] 未检测到 Python。请安装 Python 3.9+。"
    echo "       https://www.python.org/downloads/"
    exit 1
fi
echo "[检测] Python: $PYTHON_CMD ($($PYTHON_CMD --version 2>&1))"

# === 检测 Node.js ===
if ! command -v node >/dev/null 2>&1; then
    echo "[错误] 未检测到 Node.js。请安装 Node.js 18+。"
    echo "       https://nodejs.org/"
    exit 1
fi
echo "[检测] Node.js: $(node --version)"

# === 后端 .env 检查 ===
if [ ! -f "backend/.env" ]; then
    echo ""
    echo "[错误] 缺少 backend/.env 文件！"
    exit 1
fi
if grep -q "your-api-key-here" "backend/.env" 2>/dev/null; then
    echo ""
    echo "[!!!] 检测到 backend/.env 中 API Key 还是默认值！"
    echo "      请编辑 backend/.env，把 your-api-key-here 替换成你的真实 API Key"
    echo ""
    exit 1
fi
echo "[检测] backend/.env: API Key 已配置"

# === 后端虚拟环境 & 依赖 ===
if [ ! -d "backend/.venv" ]; then
    echo "[安装] 创建 Python 虚拟环境..."
    $PYTHON_CMD -m venv backend/.venv
fi

echo "[安装] 升级 pip..."
backend/.venv/bin/python -m pip install --upgrade pip -q
echo "[安装] 安装后端依赖..."
backend/.venv/bin/pip install -q -r backend/requirements.txt

# === 前端依赖 ===
if [ ! -d "node_modules" ]; then
    echo "[安装] 安装前端依赖..."
    npm install
fi

# === 启动 ===
echo ""
echo "============================================"
echo "  启动服务..."
echo "  后端: http://localhost:8765"
echo "  前端: http://localhost:5173"
echo "  按 Ctrl+C 停止所有服务"
echo "============================================"
echo ""

# 启动后端（后台）
backend/.venv/bin/python backend/server.py &
BACKEND_PID=$!

# 启动前端（前台）
npm run dev

# 前端退出后关闭后端
kill $BACKEND_PID 2>/dev/null
echo ""
echo "服务已停止。"
