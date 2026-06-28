#!/bin/bash
set +e
cat <<'NUDGE'
🧠 若本轮产出任何 durable 的东西，更新 .claude/memory/：
- 新被纠正的坑 → 追加 learnings.md（带日期、最新在上、绝不改写）
- 新事实 / 结果 / ID / 配置 → 更新 memory.md（覆盖过时）
- 新共享约定 / 偏好 → 更新 wiki.md
- ⚠️ 临时任务/一次性信息 → 不要写进记忆（会污染决策）
没有就说"无新记忆" —— 别默默跳过。
NUDGE
exit 0
