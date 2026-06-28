# Learnings — 被纠正过的坑（只追加，最新在上）

>
## 2026-06-28 xlsx (SheetJS) 社区版不支持写入富文本
- 坑：用 `cell.r` 属性设置富文本 XML（加粗+颜色），但导出的 xlsx 文件中格式全部丢失
- 纠正：xlsx 的 `write_zip_xlsx` 在构建 SST（共享字符串表）时只取 `cell.v`，完全忽略 `cell.r`。需要用 JSZip 后处理：xlsx 写出后解压 ZIP → 替换 `xl/sharedStrings.xml` 中的纯文本 `<si>` 为富文本版 → 重新打包下载
- 为什么：白花了半小时排查为啥 `r` 属性不生效，最后读 xlsx 源码才发现写入路径根本不处理它
## 2026-06-28 记忆文件修改后忘记 git commit
- 坑：改完 `learnings.md` / `memory.md` 后认为任务完成，忘了 `git commit`，需要用户提醒
- 纠正：记忆文件的修改也是「功能切片」——改完立刻提交，不等提醒
- 为什么：wiki.md 明明写了「每完成一个功能切片 → 立即 git commit」，但记忆文件被我下意识排除在外了

## 2026-06-28 memory.md 大小写显示混淆
- 坑：Windows 文件系统大小写不敏感，文件实际是 `memory.md`（小写），但 IDE 标签页可能显示为 `MEMORY.md`，看起来像是两个不同文件
- 纠正：确认磁盘上只有小写 `memory.md`；如果项目要跨平台（Linux/macOS），文件名大小写必须严格一致
- 为什么：在 Windows 上 `memory.md` 和 `MEMORY.md` 是同一个文件不会出错，但跨平台引用可能找不到文件

## 2026-06-28 /compact 后缺乏持久记忆导致 token 严重浪费
- 坑：早期 memory.md / wiki.md 几乎为空，每次 /compact 后关键知识丢失，我需要重读大量文件才能恢复上下文
- 纠正：每个 substantive 任务收尾必须回写 memory；memory.md 记录稳定事实（ID/配置/决策），wiki.md 记录约定偏好，learnings.md 追加踩坑经验
- 为什么：一次 compaction 就浪费数千 token 重读文件，累计浪费远超维护记忆的成本

## 2026-06-28 Memory 闭环断裂 —— 写一次就不再维护
- 坑：claude-memory skill 被装好后，我只在第一次写入了 memory.md，之后再也没有回写，导致记忆严重滞后于项目实际状态
- 纠正：Stop hook 的提醒不是摆设——每次 substantive 任务收尾必须检查是否有 durable 产出需要回写；没有就说"无新记忆"，不能默默跳过
- 为什么：记忆过时的危害比没有记忆更大——它会让我基于错误的假设做决策

## 2026-06-28 Plan 文件写入 C 盘而非项目目录
- 坑：使用 `/plan` 功能时，plan 文件被写到了 `C:\Users\Admin\.claude\plans\` 而不是项目的 `.claude/` 下，导致 plan 脱离项目上下文、不会被 git 跟踪
- 纠正：每个项目开始时就确认 plan 输出路径在项目目录下；C 盘的 plan 文件是 Claude Code 的默认行为，需要主动管理
- 为什么：plan 和项目分离导致事后无法回溯设计决策，清理时也容易遗漏
