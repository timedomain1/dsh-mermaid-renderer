# dsh-mermaid-renderer

[English](README.md) | 中文

DeepSeek Harness（dsh）聊天界面插件：自动把聊天里的 **Mermaid 代码块**渲染成图表卡片。
支持 `flowchart / graph / sequenceDiagram / classDiagram / stateDiagram / erDiagram / journey / gantt / pie / mindmap / timeline / C4Context / gitGraph` 等 Mermaid 图型。

> **同时适用于命令行网页端与官方桌面端**——桌面端内置的就是同一套聊天界面，两者共用同一份插件代码。

## 功能

- 聊天中的 ```mermaid 代码块自动变为渲染图（流式输出、切会话、滚动重建后都会自动补扫）；
- **全局美化默认值**：未自带 `%%{init}%%` 的图自动获得更大的字号/间距、柔和连线色与中性节点底色、`basis` 曲线（每张图自己的 init 指令仍可覆盖）；
- 每个图表卡片可切换「图表 / 代码」两个视图；
- **连续放大 / 缩小 / 还原**（0.25x–4x，无次数限制；卡片内 Ctrl+滚轮 也可缩放，超出宽度时横向滚动）；
- **⛶ 独立查看器**：全屏浮层单独打开（不受聊天区重渲染影响），滚轮绕光标缩放（5%–1000%）、拖拽平移、适应宽度 / 100%、双击适应、ESC 关闭；还可「新标签页打开」成独立自包含页面，配合浏览器缩放查看全局；
- 一键「复制源码」；
- Mermaid 引擎**按需加载**（首个图表出现时才拉取），且**离线可用**；
- 纯 DOM 后处理，不侵入界面框架，卸载后页面恢复原样（样式、定时器、监听均由 `ctx.effect` 托管回收）。

## 兼容性

**同一份代码同时支持命令行网页端与官方桌面端**——两个宿主在客户端插件契约上完全一致（已实测比对
`dsh-client-modules` / `dsh-client-ui-conversation` / `dsh-cordis-client-runner`）。

| 宿主 | 版本（实测通过） | profile 名 |
|---|---|---|
| 命令行 `dsh web` | `0.1.5-rc.1` | `web` |
| **官方桌面端（最新版）** | **`0.2.0-rc.2`** | `desktop` |

> 两端是**两份独立的安装记录**（读不同的 profile），所以要让两边都生效就得装两次——代码只有一份。
> ⚠️ 改源码后的生效方式**两端不同**：桌面端是链接到源码，重启即生效；网页端是拷贝，
> **必须卸载后重装**才会更新（`add --force` 无效）。

## 安装

要求：DeepSeek Harness `>=0.1.5-rc.1`（**已适配最新桌面端 `0.2.0-rc.2`**），且已启用 pnpm。

> 前置准备（一次性）：`dsh plugin` 底层调用 pnpm。若 `pnpm --version` 提示找不到命令，在管理员终端执行 `corepack enable` 启用（Node 自带 corepack），然后新开一个终端即可。

### 命令行网页端（profile 名 `web`）

```bash
# 从 GitHub 安装（推荐：无需发布 npm）
dsh plugin --profile web add git+https://github.com/timedomain1/dsh-mermaid-renderer.git

# 或从本地目录安装（适合二次开发）
dsh plugin --profile web add file:/path/to/dsh-mermaid-renderer
```

### 官方桌面端（profile 名 `desktop`）

桌面端内置 Node/pnpm，**不必装命令行环境**。在应用内打开「插件」页 → 添加插件，填入以下任一形式：

```
https://github.com/timedomain1/dsh-mermaid-renderer          # Git 仓库地址（推荐）
D:\DeepSeekHarness\plugins\dsh-mermaid-renderer              # 本机插件目录（须为绝对路径）
```

> 桌面端插件管理器接受四类来源：npm 包名、Git 仓库地址、tarball 链接（`.tgz`）、本机绝对路径。
> **相对路径会被拒绝**，本地安装必须写完整绝对路径。
>
> 注：`desktop` profile 由桌面应用独占管理，命令行 `dsh plugin --profile desktop` 会被拒绝
> （`profile "desktop" is managed exclusively by the Electron application`），请在应用内操作。

### 版本与下载

最新版本见 [Releases](https://github.com/timedomain1/dsh-mermaid-renderer/releases)，
每个版本带完整变更说明与宿主兼容性表。

### 装完的验证

**重启对应宿主**（命令行重启 `dsh web`；桌面端完全退出后重开），然后发送一个 ```mermaid 代码块，
或打开历史消息中的 mermaid 代码块。两端各自独立生效，装了一边不影响另一边。

打开开发者控制台可看到启用日志（**桌面端按 F12 或 Ctrl+Shift+I；浏览器按 F12**）：

```
[dsh-mermaid-renderer] v1.3.0 已启用：聊天中的 Mermaid 代码块将自动渲染
```

> 说明：`dsh plugin` 会转发给 pnpm 安装并把本包（声明了 `dsh.bundle.patch`）自动加入对应 profile 的 bundle 层。无 pnpm 时也可手动安装：把本包目录放进 `$DSH_HOME/profiles/<profile>/node_modules/dsh-mermaid-renderer/`，并把 `"dsh-mermaid-renderer"` 追加进该 profile `package.json` 的 `dsh.profile.bundles` 列表。
>
> 桌面端 profile 由应用独占管理，命令行 `dsh plugin --profile desktop` 会被拒绝
> （`profile "desktop" is managed exclusively by the Electron application`），请在应用内「插件」页操作。

## 卸载

```bash
dsh plugin --profile web remove dsh-mermaid-renderer       # 命令行网页端
```

桌面端：在「插件」页里移除 `dsh-mermaid-renderer`。手动安装者：删除对应 profile 的
`node_modules/dsh-mermaid-renderer/` 目录，并移除该 profile `package.json` 中 bundles 列表里的条目。

重启对应宿主后生效。

## 兼容性与依赖

- 浏览器半：运行时不依赖任何第三方包（手写 `__ModuleLoader__` 静态 bundle，按官方 `dsh.client` 协议打包）；
  内联的 Mermaid 引擎已随文件分发，**不需要联网**；
- 宿主半：空 `apply`，仅用于出现在 Cordis 组合中（同官方 `dsh-client-ui-*` 插件模式）；
- 清单声明 `dsh.client.immediately` 与 `inject: ["@deepseek-ai/dsh-client-ui-conversation"]`，
  让插件在会话界面就绪后再激活（与官方 `templates/decoration` 一致；两个宿主均支持这两个字段）；
- **Mermaid 引擎加载顺序**（首个图表出现时才拉取，结果缓存）：
  1. `window.__DSH_MERMAID_URL__`（自定义镜像，可在控制台设置）
  2. jsDelivr → unpkg（联网，8 秒超时，失败自动换下一个）
  3. **内联引擎**（随 `client.js` 分发，离线兜底）
- `lib/client.js` 是**生成物**（约 3.43 MB，含内联引擎）。改代码请改 `lib/client.src.js`，
  然后运行 `node scripts/build-client.mjs`。校验生成物是否最新：
  `node scripts/build-client.mjs --check`；验证引擎可用：`node scripts/test-inline-engine.mjs`。

### 这 3.43 MB 会不会反复下载？

不会。宿主对插件 bundle 设了 `cache-control: public, max-age=31536000, immutable`，且 URL 带内容指纹——
**不升级插件就不会重新传输**；只有升级插件、清空缓存或更换浏览器时才下载一次。
桌面端（Junction 链接到本机源码）更是直接读本机磁盘，不经过网络。

> 注：插件的 bundle 位于启动清单的 `application` 预加载批次，与 `dsh.client.immediately` 无关——
> 后者决定"何时执行"，不是"何时下载"。详见 `CHANGELOG.md` 的对应小节与设计权衡记录。

## 分享 / 发布到社区

发布以 GitHub 为主（`main` 分支 + 版本 tag + Release）。仓库内附有一键发布脚本，
**Release 说明直接取自 `CHANGELOG.md` 对应小节**，因此两者不会脱节：

```bash
# 1. 发版前：改 package.json 版本号 + 更新 CHANGELOG.md（含兼容性对照表）
# 2. 提交并打 tag
git add -A && git commit -m "feat: ..." && git tag vX.Y.Z && git push origin main --tags
# 3. 发布 Release（先 --dry-run 看一眼）
node scripts/publish-github-release.mjs vX.Y.Z --dry-run
node scripts/publish-github-release.mjs vX.Y.Z
```

> 脚本从 `git remote get-url origin` 自动识别仓库（在 fork 里也能直接用），
> 令牌取自 git 凭据助手，不会打印。

其它可选动作：

1. 升级引擎：`node scripts/vendor-mermaid.mjs` 重新下载 `.vendor/mermaid.min.js` →
   `node scripts/build-client.mjs` 重建 → `node scripts/test-inline-engine.mjs` 验证；
2. 如需 tarball 供桌面端插件管理器按 URL 安装，把 `npm pack` 产物作为 Release 附件上传；
3. 注册进社区目录：
   - [dsh.fish](https://github.com/stvlynn/dsh.fish)（插件发现/安装器，按其 README 提交条目）
   - [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins)
   - [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)
   - [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)

> 可选：`npm publish` 后即可用包名安装（`dsh plugin add dsh-mermaid-renderer`）。当前未发布。

## 工作原理

包是标准的「双面」dsh 插件：`cordis.patch.yml`（`dsh.bundle.patch`）在 profile 组合中插入一行（`name` 为包名），宿主的客户端模块系统（`@deepseek-ai/dsh-client-modules`）据此扫描 `dsh.client` 声明，把 `lib/client.js` 注入网页启动清单，浏览器侧的 Cordis loader 实例化后调用 `apply(ctx)`。`apply` 里用 `MutationObserver` 监听聊天区 DOM，发现 Mermaid 代码块后懒加载引擎并渲染为 SVG。

样式、定时器与 DOM 监听统一登记在 `apply` 的 `ctx.effect` 内，插件卸载时一并回收，页面不留残余。

> 为什么是 DOM 后处理而不是官方槽位：官方目前**没有为代码块内容提供扩展点**（全部槽位均不能接管 markdown 代码渲染，renderer 包也未暴露 markdown/remark 扩展）。官方文档推荐的 `conversation.chat.node` 槽用于**新增**消息行，无法改写既有代码块，因此本插件采用 DOM 后处理。详见 `CHANGELOG.md` 的已知偏差一节。

## 仓库结构

```
lib/client.src.js         手写模板（改代码改这里）
lib/client.js             生成物，含内联引擎（勿手改）
lib/index.js              宿主半（空 apply）
.vendor/mermaid.min.js    内联用的引擎（已提交，构建可离线复现）
scripts/build-client.mjs  构建：模板 + 引擎 → lib/client.js
scripts/test-inline-engine.mjs  验证内联引擎可用
scripts/publish-github-release.mjs  一键发布 Release（说明取自 CHANGELOG）
cordis.patch.yml          bundle 补丁
CHANGELOG.md              版本与宿主兼容性对照表
```

## License

MIT
