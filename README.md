# dsh-mermaid-renderer

English | [中文](README.zh.md)

A DeepSeek Harness (dsh) chat-UI plugin that renders **Mermaid code blocks** in the chat as diagram cards.
Supports `flowchart / graph / sequenceDiagram / classDiagram / stateDiagram / erDiagram / journey / gantt / pie / mindmap / timeline / C4Context / gitGraph` and more.

> **Works in both the command-line web UI and the official desktop app** — the desktop app embeds the same
> chat UI, and both hosts share one plugin codebase.

## Features

- ```mermaid code blocks in the chat render automatically (streaming output, session switches and virtualized re-renders are re-scanned);
- Each card toggles between **diagram / source** views;
- **Repeatable zoom in / out / reset** (0.25x–4x, unlimited steps; Ctrl+wheel also zooms inside the card; horizontal scroll past container width);
- **⛶ standalone viewer**: a fullscreen overlay (mounted on `document.body`, immune to chat re-renders) with cursor-centered wheel zoom (5%–1000%), drag-to-pan, fit-width / 100%, double-click to fit, ESC to close; plus **open in a new tab** as a self-contained page for global viewing with the browser's own zoom;
- One-click **copy source**;
- The Mermaid engine is **lazy-loaded** (fetched on the first diagram) and **works offline**;
- Pure DOM post-processing — no UI framework internals touched; removing the plugin restores the original page (styles, timers and listeners are all disposed through `ctx.effect`).

## Compatibility

**One codebase serves both the command-line web UI and the official desktop app** — the two hosts share an
identical client-plugin contract (verified against `dsh-client-modules` / `dsh-client-ui-conversation` /
`dsh-cordis-client-runner`).

| Host | Version (tested) | profile name |
|---|---|---|
| CLI `dsh web` | `0.1.5-rc.1` | `web` |
| **Official desktop app (latest)** | **`0.2.0-rc.2`** | `desktop` |

> The two hosts read **separate profiles**, so enabling both means installing twice — the code itself is shared.
> ⚠️ How a source edit propagates **differs**: the desktop app links to the source (restart is enough), while
> the web profile gets a **copy** — it must be **removed and re-added** to update (`add --force` does not work).

## Install

Requires DeepSeek Harness `>=0.1.5-rc.1` (**supports the latest desktop app, `0.2.0-rc.2`**) with pnpm enabled.

> One-time prerequisite: `dsh plugin` shells out to pnpm. If `pnpm --version` fails, run `corepack enable` in an admin terminal (Node ships corepack), then open a new terminal.

### Command-line web UI (profile `web`)

```bash
# From GitHub (recommended — no npm publish needed)
dsh plugin --profile web add git+https://github.com/timedomain1/dsh-mermaid-renderer.git

# Or from a local checkout (good for development)
dsh plugin --profile web add file:/path/to/dsh-mermaid-renderer
```

### Official desktop app (profile `desktop`)

The desktop app bundles its own Node/pnpm, so no command-line toolchain is required. Open the in-app
**Plugins** page → add plugin, and enter either form:

```
https://github.com/timedomain1/dsh-mermaid-renderer          # Git repository URL (recommended)
D:\DeepSeekHarness\plugins\dsh-mermaid-renderer              # local plugin directory (must be absolute)
```

> The desktop plugin manager accepts four source forms: npm package name, Git repository URL, tarball URL
> (`.tgz`), and an absolute local path. **Relative paths are rejected.**
>
> The `desktop` profile is owned exclusively by the Electron app: `dsh plugin --profile desktop` is rejected
> (`profile "desktop" is managed exclusively by the Electron application`). Use the in-app page.

### Versions and downloads

See [Releases](https://github.com/timedomain1/dsh-mermaid-renderer/releases) — every version carries full
change notes and a host-compatibility table.

### Verifying

**Restart the host** (restart `dsh web`; fully quit and reopen the desktop app), then send a ```mermaid code
block or open one in an existing message. The two hosts are independent — installing for one does not affect
the other.

Open the developer console for the startup line (**desktop app: F12 or Ctrl+Shift+I; browser: F12**):

```
[dsh-mermaid-renderer] v1.3.0 已启用：聊天中的 Mermaid 代码块将自动渲染
```

> `dsh plugin` forwards to pnpm and adds this package (it declares `dsh.bundle.patch`) to the target profile's bundle layer automatically. Without pnpm you can install manually: place this package directory at `$DSH_HOME/profiles/<profile>/node_modules/dsh-mermaid-renderer/` and append `"dsh-mermaid-renderer"` to `dsh.profile.bundles` in that profile's `package.json`.

## Uninstall

```bash
dsh plugin --profile web remove dsh-mermaid-renderer       # command-line web UI
```

Desktop app: remove `dsh-mermaid-renderer` from the in-app Plugins page. Manual installs: delete the
`node_modules/dsh-mermaid-renderer/` directory and the bundles entry in the corresponding profile.

Restart the host afterwards.

## Compatibility & dependencies

- Browser half: no third-party runtime packages (hand-written static bundle in the official `dsh.client` /
  `__ModuleLoader__` protocol); the inlined Mermaid engine ships with the file, so **no internet is required**;
- Host half: empty `apply` (present in the Cordis composition only), same pattern as the official `dsh-client-ui-*` packages;
- Manifest declares `dsh.client.immediately` and `inject: ["@deepseek-ai/dsh-client-ui-conversation"]`, so the
  plugin activates after the conversation UI is ready (matches the official `templates/decoration`; both hosts
  support these fields);
- **Engine load order** (fetched on the first diagram, then cached):
  1. `window.__DSH_MERMAID_URL__` (custom mirror, settable from the console)
  2. jsDelivr → unpkg (online, 8-second timeout, falls through on failure)
  3. **the inlined engine** (ships inside `client.js` — the offline fallback)
- `lib/client.js` is **generated** (≈3.43 MB with the engine inlined). Edit `lib/client.src.js` instead, then run
  `node scripts/build-client.mjs`. Verify freshness with `node scripts/build-client.mjs --check`, and verify the
  engine with `node scripts/test-inline-engine.mjs`.

### Is that 3.43 MB downloaded repeatedly?

No. The host serves a plugin bundle with `cache-control: public, max-age=31536000, immutable`, and bundle URLs
carry a content fingerprint — so **nothing is re-transferred unless the plugin is upgraded**, the cache is
cleared, or the browser changes. In the desktop app the bundle is a local junction to the source directory and
never crosses the network at all.

> Note: plugin bundles sit in the boot manifest's `application` preload batch, which is independent of
> `dsh.client.immediately` — that flag governs *when the factory executes*, not *when the bytes are fetched*.
> See the corresponding section in `CHANGELOG.md`.

## Share / publish to the community

Distribution is GitHub-first (`main` branch + version tags + Releases). A publish script is included, and it
takes the release notes **from the CHANGELOG section**, so the two never drift apart:

```bash
# 1. Before releasing: bump package.json and update CHANGELOG.md (incl. the compatibility table)
# 2. Commit and tag
git add -A && git commit -m "feat: ..." && git tag vX.Y.Z && git push origin main --tags
# 3. Publish the Release (check the payload first)
node scripts/publish-github-release.mjs vX.Y.Z --dry-run
node scripts/publish-github-release.mjs vX.Y.Z
```

> The script derives owner/repo from `git remote get-url origin` (so it works from a fork) and reads the token
> from the git credential helper without printing it.

Other optional steps:

1. Upgrade the engine: re-run `scripts/vendor-mermaid.mjs` to refresh `.vendor/mermaid.min.js`, rebuild with
   `node scripts/build-client.mjs`, then verify with `node scripts/test-inline-engine.mjs`;
2. To offer a tarball for the desktop plugin manager's URL form, attach `npm pack` output to the Release;
3. Register in community directories:
   - [dsh.fish](https://github.com/stvlynn/dsh.fish) (plugin discovery/installer — follow its README to add an entry)
   - [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins)
   - [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)
   - [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)

> Optional: `npm publish` would also allow installing by package name. Not published at this time.

## How it works

The package is a standard dual-face dsh plugin: `cordis.patch.yml` (`dsh.bundle.patch`) inserts one row (its `name` is the package name) into the profile composition; the host's client-modules service (`@deepseek-ai/dsh-client-modules`) discovers the `dsh.client` declaration, serves `lib/client.js` through the plugins route and injects it into the boot manifest; the browser Cordis loader instantiates it and calls `apply(ctx)`. `apply` watches the chat DOM with a `MutationObserver`, lazy-loads Mermaid and renders SVG in place.

Styles, timers and DOM listeners are registered inside `apply`'s `ctx.effect`, so unloading the plugin disposes
all of them and leaves no residue on the page.

> Why DOM post-processing instead of an official slot: the host currently exposes **no extension point for code
> block content** (none of the available slots can take over markdown code rendering, and the renderer package
> exposes no markdown/remark extension). The documented `conversation.chat.node` slot **adds** message rows and
> cannot rewrite existing code blocks. See the "known deviations" section in `CHANGELOG.md`.

## Repository layout

```
lib/client.src.js         hand-written template — edit this one
lib/client.js             generated, contains the inlined engine (do not edit)
lib/index.js              host half (empty apply)
.vendor/mermaid.min.js    the inlined engine (committed, so builds work offline)
scripts/build-client.mjs  build: template + engine → lib/client.js
scripts/test-inline-engine.mjs  verify the inlined engine initializes
scripts/publish-github-release.mjs  publish a Release (notes come from CHANGELOG)
cordis.patch.yml          bundle patch
CHANGELOG.md              versions and the host-compatibility table
```

## License

MIT
