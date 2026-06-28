#!/bin/bash
set +e
ROOT="${CLAUDE_PROJECT_DIR:-$(pwd)}"; MEM="$ROOT/.claude/memory"
emit() {
  [ -f "$1" ] || return 0
  local body; body="$(grep -vE '^[[:space:]]*(>|#|$)' "$1")"
  [ -z "${body//[[:space:]]/}" ] && return 0
  echo "## $2"; echo '```markdown'; cat "$1"; echo '```'; echo
}
OUT=""
OUT+="$(emit "$MEM/memory.md"    'memory.md —— 稳定事实')"$'\n'
OUT+="$(emit "$MEM/wiki.md"      'wiki.md —— 共享约定 & 偏好')"$'\n'
OUT+="$(emit "$MEM/learnings.md" 'learnings.md —— 被纠正过的坑')"$'\n'
if [ -n "$(printf '%s' "$OUT" | tr -d '[:space:]')" ]; then
  echo "🧠 持久记忆（claude-memory）—— 动手前先读："; echo; echo "$OUT"
fi
exit 0
