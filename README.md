# dsh-mermaid-renderer

English | [中文](README.zh.md)

A DeepSeek Harness (dsh) web plugin that renders **Mermaid code blocks** in the chat as diagram cards.
Supports `flowchart / graph / sequenceDiagram / classDiagram / stateDiagram / erDiagram / journey / gantt / pie / mindmap / timeline / C4Context / gitGraph` and more.

## Features

- ```mermaid code blocks in the chat render automatically (streaming output, session switches and virtualized re-renders are re-scanned);
- Each card toggles between **diagram / source** views;
- **Repeatable zoom in / out / reset** (0.25x–4x, unlimited steps; Ctrl+wheel also zooms inside the card; horizontal scroll past container width);
- **⛶ standalone viewer**: a fullscreen overlay (mounted on `document.body`, immune to chat re-renders) with cursor-centered wheel zoom (5%–1000%), drag-to-pan, fit-width / 100%, double-click to fit, ESC to close; plus **open in a new tab** as a self-contained page for global viewing with the browser's own zoom;
- One-click **copy source**;
- The Mermaid engine is **lazy-loaded** (fetched on first diagram; requires internet), failures keep the source view with a retry hint;
- Pure DOM post-processing — no UI framework internals touched; removing the plugin restores the original page (styles, timers and listeners are all disposed through `ctx.effect`).

## Compatibility

**One codebase serves both the command-line web UI and the official desktop app** — the two hosts share an
identical client-plugin contract (verified against `dsh-client-modules` / `dsh-client-ui-conversation` /
`dsh-cordis-client-runner`).

| Host | Version (tested) | profile name |
|---|---|---|
| CLI `dsh web` | `0.1.5-rc.1` | `web` |
| Official desktop app | `0.2.0-rc.2` | `desktop` |

> The two hosts read **separate profiles**, so enabling both means installing twice — the code itself is shared,
> and a source edit takes effect in both after their next restart.

## Install

Requires DeepSeek Harness `>=0.1.5-rc.1` (compatible with `0.2.x`) with pnpm enabled.

> One-time prerequisite: `dsh plugin` shells out to pnpm. If `pnpm --version` fails, run `corepack enable` in an admin terminal (Node ships corepack), then open a new terminal.

### Command-line web UI (profile `web`)

```bash
# From GitHub (recommended — no npm publish needed)
dsh plugin --profile web add git+https://github.com/timedomain1/dsh-mermaid-renderer.git

# Or from a local checkout (edits take effect on restart — good for development)
dsh plugin --profile web add file:/path/to/dsh-mermaid-renderer
```

### Official desktop app (profile `desktop`)

The desktop app bundles its own Node/pnpm, so no command-line toolchain is required. Open the in-app
**Plugins** page → add plugin, and enter either form:

```
https://github.com/timedomain1/dsh-mermaid-renderer          # Git repository URL
D:\DeepSeekHarness\plugins\dsh-mermaid-renderer              # local plugin directory (must be absolute)
```

> The desktop plugin manager accepts four source forms: npm package name, Git repository URL, tarball URL
> (`.tgz`), and an absolute local path. **Relative paths are rejected.**

### Verifying

**Restart the host** (restart `dsh web`; fully quit and reopen the desktop app), then send a ```mermaid code
block or open one in an existing message. The two hosts are independent — installing for one does not affect
the other.

> `dsh plugin` forwards to pnpm and adds this package (it declares `dsh.bundle.patch`) to the target profile's bundle layer automatically. Without pnpm you can install manually: place this package directory at `$DSH_HOME/profiles/<profile>/node_modules/dsh-mermaid-renderer/` and append `"dsh-mermaid-renderer"` to `dsh.profile.bundles` in that profile's `package.json`.

## Uninstall

```bash
dsh plugin --profile web remove dsh-mermaid-renderer       # command-line web UI
```

Desktop app: remove `dsh-mermaid-renderer` from the in-app Plugins page. Manual installs: delete the
`node_modules/dsh-mermaid-renderer/` directory and the bundles entry in the corresponding profile.

Restart the host afterwards.

## Compatibility & dependencies

- Browser half: zero third-party dependencies (hand-written static bundle in the official `dsh.client` / `__ModuleLoader__` protocol);
- Host half: empty `apply` (present in the Cordis composition only), same pattern as the official `dsh-client-ui-*` packages;
- Manifest declares `dsh.client.immediately` and `inject: ["@deepseek-ai/dsh-client-ui-conversation"]`, so the
  plugin activates after the conversation UI is ready (matches the official `templates/decoration`; both hosts
  support these fields);
- Mermaid v11 loads from the jsDelivr / unpkg CDN at first render (**internet required**).
  Override the engine URL with `window.__DSH_MERMAID_URL__ = 'https://your-mirror/mermaid.min.js'`.
  For offline setups, inline `mermaid.min.js` into the loader logic in `lib/client.js`.

## Share / publish to the community

Distribution is GitHub-first (`main` branch + version tags + Releases):

1. Bump `package.json`, update `CHANGELOG.md`, then `git tag vX.Y.Z && git push --tags`;
2. Publish the tag as a GitHub Release describing the change;
3. To offer a tarball for the desktop plugin manager's URL form, attach `npm pack` output to the Release;
4. Register in community directories:
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

## License

MIT
