# Agent Skill 索引

本仓库的项目级 agent workflow skill 放在 `.agents/skills` 下。Claude 侧通过本文件索引这些项目 skill。

## 触发规则

- 当用户说 `提交`、`提交代码`、`commit`、`push`、`创建 PR`，或要求完成本地改动时，必须先读取 `.agents/skills/project-submit-workflow/SKILL.md`，再按其中工作流执行。
- 当用户说 `发布`、`发版`、`release`、`打 tag`，或要求发布新版本时，必须先读取 `.agents/skills/project-release-workflow/SKILL.md`，再按其中工作流执行。
- 如果当前运行环境没有自动发现 `.agents/skills`，也要把上面两个文件当作本仓库的项目级 skill 手动加载。

## Skill 列表

- `.agents/skills/project-submit-workflow/SKILL.md`
  - 当用户说 `提交`、`提交代码`、`commit`、`push`、`创建 PR`，或要求完成本地改动时使用。
  - 处理基于 `main` 的分支检查、版本/CHANGELOG/README 判断、仓库风格提交、push 和 GitHub PR 创建。

- `.agents/skills/project-release-workflow/SKILL.md`
  - 当用户说 `发布`、`发版`、`release`、`打 tag`，或要求发布新版本时使用。
  - 处理 open PR 检查、用户确认后的 PR 合并、最新 `main`、版本/CHANGELOG 准备、构建、tag 和 GitHub Release 创建。

## 仓库默认约定

- 默认分支：`main`。
- 新建分支时优先跟随最近分支命名历史；如果仓库没有更明确约定，再使用 agent 专属前缀。
- 提交、PR、tag、release 和 changelog 文案都要先参考仓库最近历史再执行。
