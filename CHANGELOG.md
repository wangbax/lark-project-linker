# 更新日志

## v2.3.2 (2026-04-23)

**新增功能：**
- ✨ 支持基于 GitHub 用户目录仓库的 `GitHub / Name / Email` 映射，在 GitHub 原生用户 hovercard 中补充邮箱前缀显示

**Bug 修复：**
- 🐛 修复部分登录名与邮箱前缀存在包含或相同关系时被误判为“已显示”的问题，确保相关 hovercard 场景统一追加显示
- 🐛 调整 hovercard DOM 监听逻辑，兼容 GitHub 异步插入 `.Popover-message` 内容的时机

**文档更新：**
- 📝 配置页与 README 新增 GitHub 用户映射目录说明
- 📝 将示例中的组织/邮箱说明泛化为 `[org]`、`[email_prefix]` 占位，避免写死特定组织描述

## v2.3.1 (2026-04-14)

**Bug 修复：**
- 🐛 适配 GitHub 新版 commit history 列表 DOM 结构，恢复提交标题中的飞书项目链接替换
- 🐛 避免在替换 `#TAP-...` 时误污染 commit 链接的 `title` 等属性，防止标题节点 HTML 被破坏

**兼容性优化：**
- 🔧 调整 GitHub 标题扫描逻辑，跳过 commit row 容器，避免被误识别为 PR/Issue 标题
- 🔧 非链接标题改为基于文本节点替换项目 ID，降低后续 GitHub UI 变更带来的脆弱性

## v2.3.0 (2026-01-14)

**新增功能：**
- ✨ **GitHub 完整支持**：新增对 GitHub 平台的完整支持
  - 支持 GitHub Commits 页面（如 `github.com/user/repo/commits/branch/`）
  - 智能识别 commit 标题中的项目 ID（如 `# XX-6616715346`）
  - 点击项目 ID 部分直接跳转到飞书（无需嵌套链接）
  - 支持 GitHub Pull Request 标题和评论
  - 支持 GitHub Turbo/PJAX 导航自动刷新
  - 自动识别 GitHub issue-link 和 hovercard 链接
- 🌐 **多平台统一体验**：GitLab 和 GitHub 使用相同的智能类型识别和 Tooltip

**代码重构：**
- ♻️ **模块化架构**：将代码拆分为独立的平台处理器
  - `gitlab-handler.js` - GitLab 平台特定处理
  - `github-handler.js` - GitHub 平台特定处理
  - `index.js` - 核心通用功能
  - `store.js` - 配置存储与缓存管理
- 📚 **架构优化：**
  - 平台逻辑完全独立，互不影响
  - 通过上下文对象共享状态和功能
  - 添加新平台只需 3 步
  - 整合 7 个文档文件为统一的 README.md
- 🎯 **代码质量提升：**
  - 清理所有 console.log 调试日志
  - 统一函数命名规范
  - 完善代码注释
  - 移除所有内联脚本，符合 CSP 规范

**Bug 修复：**
- 🐛 修复 GitLab MR 列表页标题不生效问题
- 🐛 修复飞书链接拼接错误
- 🐛 修复 GitHub Issue 详情页标题不生效
- 🐛 修复 GitHub Issue 描述和评论不可点击

**UI 优化：**
- 🎨 **配置页面优化：**
  - Sentry 配置改为"其他配置"并默认折叠
  - 添加展开/折叠动画效果
  - 优化配置项布局，突出核心配置
- 🎨 **交互优化：**
  - GitHub commit 标题中的项目 ID 显示虚线下划线
  - 悬浮显示飞书项目信息 Tooltip
  - 点击项目 ID 阻止原 commit 链接跳转，直接打开飞书

## v2.2.0 (2025-01-08)

**新增功能：**
- ✨ **Sentry 工单完整功能**：
  - 支持创建飞书工单（带模态框表单）
  - 自动填充报告人和经办人（支持搜索 Sentry 成员）
  - 支持动态字段配置（优先级、严重程度等）
  - 工单描述自动转换为飞书富文本格式（doc_text、doc、doc_html）
  - 支持查询已存在的工单并直接跳转
  - 创建成功后自动更新页面显示工单号
- 🎨 **配置页面优化**：配置项按功能分组（跳转配置 / Sentry 配置）

**体验优化：**
- 💡 轻量级 Toast 通知替代弹窗提示
- 💡 工单创建模态框 UI 优化，支持暗色模式
- 💡 自动提取异常信息和堆栈（前 20 帧）
- 💡 自动设置当前用户为默认报告人

## v2.1.0 (2025-01-06)

**新增功能：**
- ✨ **Sentry 集成**：支持在 Sentry Issue 页面一键创建飞书 Issue
- ✨ 自动提取 Sentry Issue 信息并预填充到飞书
- ✨ 支持多个 Sentry 域名配置
- ✨ 自定义 Tooltip：显示 "Issue in Lark" / "Story in Lark"
- ✨ 智能类型识别：根据 commit 类型前缀自动判断 Issue/Story
- ✨ 实时监听：支持页面变化、标签切换、URL 变化自动检测
- 🎨 Tooltip 样式优化：居中对齐、向下箭头、与 GitLab 原生样式一致

**性能优化：**
- ⚡ 使用 WeakSet 追踪 DOM 元素，避免重复处理
- ⚡ 防抖机制，减少不必要的扫描
- ⚡ 类型映射缓存，确保同一 tid 类型一致
- ⚡ 智能上下文分析，提高类型判断准确性

**问题修复：**
- 🐛 修复同一 tid 多个链接类型不一致的问题
- 🐛 屏蔽 GitLab 原生的 "Issue in Jira" tooltip
- 🐛 修复 commit 列表中链接无法正确识别的问题
