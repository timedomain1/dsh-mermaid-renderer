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
- Pure DOM post-processing — no UI framework internals touched; removing the plugin restores the original page.

## Install

Requires DeepSeek Harness `0.1.0-rc.8` (web profile).

```bash
# From npm (after publishing)
dsh plugin --profile web add dsh-mermaid-renderer

# Or from a local checkout
dsh plugin --profile web add file:/path/to/dsh-mermaid-renderer
```

Then **restart `dsh web`** and refresh the browser tab. Verify by sending a ```mermaid code block in the chat.

> `dsh plugin` forwards to pnpm and adds this package (it declares `dsh.bundle.patch`) to the web profile's bundle layer automatically. Without pnpm you can install manually: place this package directory at `$DSH_HOME/profiles/web/node_modules/dsh-mermaid-renderer/` and append `"dsh-mermaid-renderer"` to `dsh.profile.bundles` in `$DSH_HOME/profiles/web/package.json`.

## Uninstall

```bash
dsh plugin --profile web remove dsh-mermaid-renderer
```

Then restart `dsh web`. Manual installs: delete the node_modules directory above and remove the bundles entry.

## Compatibility & dependencies

- Browser half: zero third-party dependencies (hand-written static bundle in the official `dsh.client` / `__ModuleLoader__` protocol);
- Host half: empty `apply` (present in the Cordis composition only), same pattern as the official `dsh-client-ui-*` packages;
- Mermaid v11 loads from the jsDelivr / unpkg CDN at first render (**internet required**).
  Override the engine URL with `window.__DSH_MERMAID_URL__ = 'https://your-mirror/mermaid.min.js'`.
  For offline setups, inline `mermaid.min.js` into the loader logic in `lib/client.js`.

## Share / publish to the community

1. Bump the version in `package.json`, then `npm publish`;
2. Register in community directories:
   - [dsh.fish](https://github.com/stvlynn/dsh.fish) (plugin discovery/installer — follow its README to add an entry)
   - [awesome-dsh-plugins](https://github.com/AdamPlatin123/awesome-dsh-plugins)
   - [awesome-deepseek-harness](https://github.com/Dominic789654/awesome-deepseek-harness)
   - [Anil-matcha/awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin)

## How it works

The package is a standard dual-face dsh plugin: `cordis.patch.yml` (`dsh.bundle.patch`) inserts one row (its `name` is the package name) into the profile composition; the host's client-modules service (`@deepseek-ai/dsh-client-modules`) discovers the `dsh.client` declaration, serves `lib/client.js` through the `/plugins` route and injects it into `window.__DSH_BOOT__`; the browser Cordis loader instantiates it and calls `apply(ctx)`. `apply` watches the chat DOM with a `MutationObserver`, lazy-loads Mermaid and renders SVG in place.

## License

MIT
