# 会话分栏 · DSH Split View

DSH（DeepSeek Harness）Web UI 客户端插件：在主区域左右并排显示**两个会话**，每栏都有完整的对话记录、输入框、队列与工具视图，互不影响。

A client plugin for the DSH Web UI that shows **two sessions side by side**, each with its own transcript, composer, queue and tool views. Pure browser-side bundle, no dependencies, no build step.

- 插件通过宿主公开的槽位机制实现，不导入任何 Harness Client 包 / built on the public slot API only.

## 入口

- **左侧栏底部面板图标**（Plugins / Schedules 旁的分栏图标）：打开分栏页；左右两栏默认分别是当前会话与最近另一个会话。
- **会话标题栏右侧的分栏按钮**（在会话工具区、日志下载等按钮旁）：把当前会话放到左栏并打开分栏页。

## 使用

- 每栏顶部是可点击的会话名胶囊：点开列表可切换会话（显示标题、工作区、运行状态；列表不含子 Agent 会话与已归档会话）。
- 中间分隔条可拖动调整左右宽度（20%–80%）：鼠标拖拽即可；**双击**分隔条复位 50%；聚焦分隔条后也可用 ←/→（Shift 加速）、Home/End 调整。比例与左右会话都会记住（`localStorage: dsh.session-split.v1`）。
- 分栏页的**顶部栏**是窗口拖拽区（macOS 桌面端），按住顶部栏空白处可拖动整个应用窗口。
- 右上角：交换左右、关闭分栏（回到普通会话视图）；每栏还有一个「在主会话中打开」按钮。
- 两栏会自动避免选中同一个会话（同一会话不支持两套同时可编辑的输入框）。
- **智能体团队（Agent Teams）**：如果你的会话带 Team（有 Lead/teammate 或共享任务），每栏头部会出现一个「团队」胶囊（成员数）。点开可看到成员列表与共享任务板；点成员会**在当前这一栏内切到该成员的会话**（仍然是分栏，不会跳到单页面），点 Lead 成员切回 Lead；想全屏打开某个会话可用栏头的「在主会话中打开」。
  官方团队面板只注册在会话标题栏（`conversation.session.header.actions`），而分栏页渲染的是不含标题栏的嵌入式会话主体，所以这里用同一份 `agentTeam` 投影做了精简入口；完整官方面板仍可在普通会话标题栏使用。

## 安装

插件是纯 JS 的 Web 客户端 bundle（Host 半边为空），macOS / Windows / Linux 的 DSH Desktop 都能用，无需 Node 依赖或构建步骤。

**方式一：从 GitHub 安装（推荐）**

DSH Web 界面 → 左侧栏 **Plugins** → **Add plugin**（或箭头菜单的 **Install a third-party plugin**）→ 填：

```text
git+https://github.com/B635/dsh-split-view.git
```

→ **Install**，装好后自动启用，左侧栏出现分栏图标即可使用（若提示需要重启，重启桌面应用）。

也可以让那台电脑上的 Agent 安装（需 danger-full-access 或批准）：

```text
plugin_manager install_bundle target=git+https://github.com/B635/dsh-split-view.git
```

**方式二：本地目录（开发调试）**

把本仓库 clone 到本地，Add plugin 里填该目录的**绝对路径**（以 link 方式安装，改代码后重装/重启即生效）。适合边改边调。

**方式三：离线 tgz**

从本仓库的 **Releases** 下载 `local-dsh-session-split-<version>.tgz`，拷到目标电脑后，Add plugin 里填 tgz 的绝对路径安装（例如 macOS `/Users/me/Downloads/local-dsh-session-split-1.2.1.tgz`、Windows `C:\Users\me\Downloads\local-dsh-session-split-1.2.1.tgz`）。

**更新 / 卸载**

- 更新：卸载后重新安装最新版（或对 GitHub 源使用 Update）；改代码后需重装 bundle 或重启桌面应用，浏览器会重新加载 client 产物。
- 卸载：Plugins 页面里找到本插件，切 Off 或卸载。
- 布局状态（左右会话、分割比例、当前显示的团队成员）存在浏览器 `localStorage`，每台机器/浏览器各自记忆。

## 兼容性

- 在 DSH Desktop `0.2.1-rc.5` 上验证（Web 客户端槽位 API）。
- 在 `package.json` 中不限制 `engines`；DSH 版本差异较大时，若出现 `slot entry crashed` 之类现象，需要按新版本 API 适配 `client.js`。
- 插件包名当前为 `@local/dsh-session-split`（本地安装名，不影响从 Git 安装）；如果要发布到 npm，改包名/去掉 `"private": true` 后再 `pnpm publish`。

## 目录结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | bundle 清单：`dsh.bundle.patch` + `dsh.client`（web 端 client 入口、加载顺序、`.immediately`） |
| `cordis.patch.yml` | 在 profile 里插入插件行 `session-split` |
| `index.js` | Host 半边（无逻辑，仅让 bundle 可安装） |
| `client.js` | 全部 UI 逻辑：locale 字典、状态持久化、分栏页、栏头、选择器、团队面板、会话标题栏按钮、侧栏图标、样式表 |
| `locale/en.json`, `locale/zh.json` | Plugin Manager 展示用元数据（`meta.title` / `meta.description`） |
| `icon.svg` | 插件图标 |

## 实现要点（改代码前先读）

- 分栏页注册为 `main` 键控面板 `key: "session-split"`，并在 `children` 里声明 **session 作用域子槽** `sessionSplit.pane` / `sessionSplit.team` —— 这是拿到框架注入的 `SessionProvider` / `renderSlot` 的前提。
- 每栏用 `ctx.sessions.retain(target, { source: "sessionSplit" })` 拿到自己的 `SessionReference`（不要复用 `mainView` 这个 source），包在 `<SessionProvider session={ref}>` 里，再渲染子槽。`target` 可以是 Session id，也可以是子 Agent 地址 `{ parentSessionId, childSessionId, mode }`，所以栏内可以直接显示团队成员会话。
- 子槽组件（`PaneConversation`）调用
  `renderFactorySlot("conversation.content", { variant: "embedded", phase, hero }, { slots: { views: FixedChatView } })`
  得到完整的会话主体（记录 + 输入框），与右侧栏 subagent 会话用的是同一套公开机制。
- 团队胶囊挂在 `sessionSplit.team` 子槽里，读的是宿主 Session store 上的 `agentTeam` 投影（与官方团队面板同源），只读；点击成员只是切换栏的 target，不触发宿主导航。
- 侧栏图标 id 必须等于 main 面板 key（`session-split`）；点击由宿主执行 `ctx.layout.selectPanel(id)`。
- 界面文字全部走 `ctx.locale.register("sessionSplit", { zh, en })`；颜色只用 `--dsw-alias-*` / `--dsw-radius-*` 主题令牌。

## License

[MIT](LICENSE)
