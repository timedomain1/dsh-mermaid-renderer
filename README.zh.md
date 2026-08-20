# dsh-mermaid-renderer

[English](README.md) | 中文

DeepSeek Harness（dsh）网页插件：自动把聊天里的 **Mermaid 代码块**渲染成图表卡片。
支持 `flowchart / graph / sequenceDiagram / classDiagram / stateDiagram / erDiagram / journey / gantt / pie / mindmap / timeline / C4Context / gitGraph` 等 Mermaid 图型。

## 功能

- 聊天中的 ```mermaid 代码块自动变为渲染图（流式输出、切会话、滚动重建后都会自动补扫）；
- **全局美化默认值**：未自带 `%%{init}%%` 的图自动获得更大的字号/间距、柔和连线色与中性节点底色、`basis` 曲线（每张图自己的 init 指令仍可覆盖）；
- 每个图表卡片可切换「图表 / 代码」两个视图；
- **连续放大 / 缩小 / 还原**（0.25x–4x，无次数限制；卡片内 Ctrl+滚轮 也可缩放，超出宽度时横向滚动）；
- **⛶ 独立查看器**：全屏浮层单独打开（不受聊天区重渲染影响），滚轮绕光标缩放（5%–1000%）、拖拽平移、适应宽度 / 100%、双击适应、ESC 关闭；还可「新标签页打开」成独立自包含页面，配合浏览器缩放查看全局；
- 一键「复制源码」；
- Mermaid 引擎**按需加载**（首个图表出现时才联网拉取），失败时保留代码视图并提示重试；
- 纯 DOM 后处理，不侵入界面框架，卸载后页面恢复原样。

## 安装

要求：DeepSeek Harness `0.1.0-rc.8`（web profile）。

```bash
# 从 GitHub 安装（推荐：无需发布 npm，立即可用）
dsh plugin --profile web add git+https://github.com/timedomain1/dsh-mermaid-renderer.git

# 或从 npm 安装（发布到 npm 后可用）
dsh plugin --profile web add dsh-mermaid-renderer

# 或从本地目录安装
dsh plugin --profile web add file:/path/to/dsh-mermaid-renderer
```

本包**无需构建步骤**（bundle 已写好），git 安装开箱即用。

安装后**重启 `dsh web`** 并刷新浏览器页面。验证：在聊天中发送一个 ```mermaid 代码块，或打开历史消息中的 mermaid 代码块。

> 说明：`dsh plugin` 会转发给 pnpm 安装并把本包（声明了 `dsh.bundle.patch`）自动加入 web profile 的 bundle 层。无 pnpm 时也可手动安装：把本包目录放进 `$DSH_HOME/profiles/web/node_modules/dsh-mermaid-renderer/`，并把 `"dsh-mermaid-renderer"` 追加进 `$DSH_HOME/profiles/web/package.json` 的 `dsh.profile.bundles` 列表。

## 卸载

```bash
dsh plugin --profile web remove dsh-mermaid-renderer
```

重启 `dsh web`。手动安装者：删除上述 node_modules 目录并移除 bundles 列表中的条目。

## 兼容性与依赖

- 浏览器半：无任何第三方依赖（手写 `__ModuleLoader__` 静态 bundle，按官方 `dsh.client` 协议打包）；
- 宿主半：空 `apply`，仅用于出现在 Cordis 组合中（同官方 `dsh-client-ui-*` 插件模式）；
- Mermaid v11 引擎在浏览器首次渲染时从 jsDelivr / unpkg CDN 加载（**需要联网**）。
  可自定义引擎地址：在浏览器控制台或更早加载的脚本里设置
  `window.__DSH_MERMAID_URL__ = 'https://你的镜像/mermaid.min.js'`。
  离线场景可自行把 `mermaid.min.js` 内联进 `lib/client.js` 的加载逻辑。

## 分享 / 发布到社区

1. 改好 `package.json` 里的版本号后 `npm publish`；
2. 注册进社区目录：
   - [dsh.fish](https://github.com/stvlynn/dsh.fish)（插件发现/安装器，按其 README 提交条目）
   - [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins)
   - [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)
   - [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)

## 工作原理

包是标准的「双面」dsh 插件：`cordis.patch.yml`（`dsh.bundle.patch`）在 profile 组合中插入一行（`name` 为包名），宿主的客户端模块系统（`@deepseek-ai/dsh-client-modules`）据此扫描 `dsh.client` 声明，把 `lib/client.js` 注入网页启动清单 `window.__DSH_BOOT__`，浏览器侧的 Cordis loader 实例化后调用 `apply(ctx)`。`apply` 里用 `MutationObserver` 监听聊天区 DOM，发现 Mermaid 代码块后懒加载引擎并渲染为 SVG。

## License

MIT
