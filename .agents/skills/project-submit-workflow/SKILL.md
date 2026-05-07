---
name: project-submit-workflow
description: 项目提交工作流。当用户说“提交”“提交代码”“commit”“push”“创建 PR”或要求完成当前仓库本地改动时使用。负责检查是否需要基于 main 重新切分支，判断是否需要升级版本、更新 CHANGELOG/README，参考仓库历史提交和 PR 规范提交代码、推送分支并创建 GitHub PR。
---

# 项目提交工作流

用于本仓库的本地改动提交。流程保持通用，但每次执行前都要从当前仓库历史中推断具体提交、PR 标题和正文风格。

## 工作流

1. 检查当前状态：
   - 执行 `git status --short --branch`。
   - 执行 `git fetch origin --prune`。
   - 用 `git symbolic-ref refs/remotes/origin/HEAD` 检测默认分支；除非远端另有指向，否则默认按 `origin/main` 处理。
   - 用 `git log --oneline --decorate -10` 和 `gh pr list --state all --limit 10` 查看最近提交和 PR 风格。

2. 判断是否需要把改动迁移到基于 `main` 的新分支：
   - 如果当前在 `main`，提交前先从 `origin/main` 新建分支。
   - 如果当前分支仍跟踪旧默认分支，例如 `origin/master`，先把 upstream 调整为 `origin/main`。
   - 如果当前分支不是基于最新 `origin/main`，且分支只包含当前任务改动，优先 rebase 到 `origin/main`。
   - 如果 rebase 有风险，例如分支包含无关提交或用户改动，则从 `origin/main` 新建分支，只迁移当前任务 diff。
   - 保留所有未提交的用户改动。除非用户明确要求，不要丢弃或 reset。

3. 检查是否需要版本、CHANGELOG 和 README 更新：
   - 同时检查当前分支名、提交历史和完整改动范围：
     - `git branch --show-current`
     - `git diff --name-status origin/main...HEAD`
     - `git diff --name-status`
     - `git diff --cached --name-status`
   - 如果分支名、提交标题或改动内容体现用户可见行为变化、扩展运行逻辑变化、manifest/权限变化、配置项变化、构建产物变化、修复线上问题或新增能力，默认需要升级版本并更新 `CHANGELOG.md`。
   - 如果只是 agent skill、README/文档、注释、测试、CI 或内部维护改动，通常不升级版本；但最终回复和 PR 正文要说明“不需要升级版本”的判断依据。
   - 需要升级版本时：
     - 先查看 `git tag --sort=-creatordate | head`、`CHANGELOG.md`、`package.json` 和 `src/manifest.json` 的历史版本格式。
     - 默认 patch bump；新增明显用户功能时用 minor；major 只能在用户明确要求或存在破坏性变更时使用。
     - 同步更新 `package.json` 和 `src/manifest.json` 的版本号，保持一致。
     - 按 `CHANGELOG.md` 现有标题、日期、emoji 和分类风格在顶部新增版本记录，描述本次用户可感知改动。
   - 检查是否需要更新 `README.md`：
     - 如果改动影响安装、配置、使用方式、权限、支持平台、截图展示、命令、链接或对用户可见的功能说明，必须同步更新 `README.md`。
     - 如果 README 不需要改，最终回复和 PR 正文要说明“不需要 README 更新”的判断依据。

4. 提交前验证：
   - 执行 `git diff --check`。
   - 如果改动涉及源码、manifest、package、workflow 或构建逻辑，执行仓库验证命令，通常是 `corepack yarn build`。
   - 如果验证无法执行，最终回复中要明确说明原因。

5. 按仓库风格提交：
   - 只 stage 属于当前任务的文件。
   - 根据 diff 推断提交类型：`fix`、`feat`、`docs`、`chore`、`refactor` 或 `test`。
   - 跟随最近提交标题风格，例如 `fix: 🐛 ...`、`feat: ✨ ...`、`docs: 📝 ...`。
   - 使用简洁中文标题。
   - 非平凡改动需要写提交正文：
     - `## 改动内容`
     - `## 影响面`

6. 推送：
   - 将当前分支推送到 `origin`。
   - 如果缺少 upstream，推送时设置 upstream。
   - 不要直接推送到 `main`。

7. 创建或更新 PR：
   - 用 `gh pr view` 检查当前分支是否已有 PR。
   - 如果没有 PR，创建目标分支为 `main` 的 GitHub PR。
   - PR 标题参考 `gh pr list` 中的历史风格，通常与提交标题保持一致。
   - PR 正文用中文总结改动、验证、版本/CHANGELOG 判断、README 判断和风险/影响面。
   - 默认创建 ready PR，除非用户明确要求 draft。

8. 最终回复：
   - 汇报分支、提交 SHA、PR URL 和已执行验证。
   - 汇报是否升级版本、是否更新 CHANGELOG、是否更新 README；如果没有更新，说明判断依据。
   - 说明远端仍需等待的检查项。
