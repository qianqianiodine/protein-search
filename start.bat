@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Protein Structure Search

echo ============================================
echo   Protein Structure Search — 启动中...
echo ============================================
echo.

cd /d "%~dp0"

REM === 检测 Python ===
set PYTHON_CMD=
python3 --version >nul 2>&1
if !errorlevel! equ 0 (
    set PYTHON_CMD=python3
) else (
    python --version >nul 2>&1
    if !errorlevel! equ 0 (
        set PYTHON_CMD=python
    )
)
if "!PYTHON_CMD!"=="" (
    echo [错误] 未检测到 Python。请安装 Python 3.10+ 并加入 PATH。
    echo        https://www.python.org/downloads/
    pause
    exit /b 1
)
echo [检测] Python: !PYTHON_CMD!

REM === 检测 Node.js ===
node --version >nul 2>&1
if !errorlevel! neq 0 (
    echo [错误] 未检测到 Node.js。请安装 Node.js 18+。
    echo        https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [检测] Node.js: !NODE_VER!

REM === 后端 .env 检查 ===
if not exist "backend\.env" (
    echo [错误] 缺少 backend\.env 文件！
    pause
    exit /b 1
)
findstr /c:"your-api-key-here" "backend\.env" >nul 2>&1
if !errorlevel! equ 0 (
    echo.
    echo [!!!] 检测到 backend\.env 中 API Key 还是默认值！
    echo       请编辑 backend\.env，把 your-api-key-here 替换成你的真实 API Key
    echo.
    pause
    exit /b 1
)
echo [检测] backend\.env: API Key 已配置

REM === 后端虚拟环境 & 依赖 ===
if not exist "backend\.venv\" (
    echo [安装] 创建 Python 虚拟环境...
    !PYTHON_CMD! -m venv backend\.venv
    if !errorlevel! neq 0 (
        echo [错误] 创建虚拟环境失败。请确认 Python 带 venv 模块。
        pause
        exit /b 1
    )
)

echo [安装] 检查后端依赖...
backend\.venv\Scripts\pip install -q -r backend\requirements.txt
if !errorlevel! neq 0 (
    echo [错误] 后端依赖安装失败。
    pause
    exit /b 1
)

REM === 前端依赖 ===
if not exist "node_modules\" (
    echo [安装] 安装前端依赖...
    call npm install
    if !errorlevel! neq 0 (
        echo [错误] 前端依赖安装失败。
        pause
        exit /b 1
    )
)

REM === 启动 ===
echo.
echo ============================================
echo   启动服务...
echo   后端: http://localhost:8765
echo   前端: http://localhost:5173
echo   按 Ctrl+C 停止所有服务
echo ============================================
echo.

REM 启动后端（后台）
start "Protein Backend" /min cmd /c "cd /d "%~dp0backend" && .venv\Scripts\python server.py"

REM 启动前端（前台）
call npm run dev

REM 前端退出后关闭后端
taskkill /fi "WINDOWTITLE eq Protein Backend" >nul 2>&1
echo.
echo 服务已停止。
pause
