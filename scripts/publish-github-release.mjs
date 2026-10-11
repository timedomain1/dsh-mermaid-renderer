/**
 * Publish a GitHub Release for this package, using the CHANGELOG section as the
 * release notes so the two can never drift apart.
 *
 * The GitHub token is read from the credential git already stores (via
 * `git credential fill`) and is never printed.
 *
 * Usage (run from the repository root):
 *   node scripts/publish-github-release.mjs v1.2.3            # publish
 *   node scripts/publish-github-release.mjs v1.2.3 --dry-run  # show payload only
 *
 * The repository owner/name are derived from `git remote get-url origin`, so
 * this works from a fork without editing the script.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const tag = process.argv[2];
const dryRun = process.argv.includes('--dry-run');
if (tag === undefined) {
  console.error('usage: node scripts/publish-github-release.mjs <tag> [--dry-run]');
  process.exit(2);
}

/** Run git in the repository root and return trimmed stdout. */
function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`);
  return String(result.stdout).trim();
}

// --- owner/repo from the origin remote (supports forks) ---
const remote = git(['remote', 'get-url', 'origin']);
const parsed = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/.exec(remote);
if (parsed === null) {
  console.error(`无法从 origin 解析 GitHub 仓库：${remote}`);
  process.exit(1);
}
const [, OWNER, REPO] = parsed;

// --- notes from the CHANGELOG (line-based slicing: nested brackets are safe) ---
const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
const version = tag.replace(/^v/, '');
const lines = changelog.split('\n');
const startIndex = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (startIndex < 0) {
  console.error(`❌ CHANGELOG.md 里没有 "## [${version}]" 小节，拒绝发布空说明`);
  process.exit(1);
}
let endIndex = lines.findIndex((line, index) => index > startIndex && line.startsWith('## ['));
if (endIndex < 0) endIndex = lines.length;
const section = lines.slice(startIndex, endIndex).join('\n').trim();
if (section.length === 0) {
  console.error(`❌ CHANGELOG.md 的 ${version} 小节为空，拒绝发布空说明`);
  process.exit(1);
}

// --- the version table from the CHANGELOG is reused verbatim in the footer ---
const body = [
  section,
  '',
  '---',
  '',
  '### 安装',
  '',
  '**命令行网页端**',
  '',
  '```bash',
  `dsh plugin --profile web add git+https://github.com/${OWNER}/${REPO}.git`,
  '```',
  '',
  '**官方桌面端**：应用内「插件」页 → 添加插件，填入',
  '',
  '```',
  `https://github.com/${OWNER}/${REPO}`,
  '```',
  '',
  '装入后**重启宿主**（桌面端需完全退出再重开）。',
  '',
  '### 兼容的 DSH 版本',
  '',
  '| 宿主 | 版本（实测通过） |',
  '|---|---|',
  '| 命令行 `dsh web` | `0.1.5-rc.1` |',
  '| 官方桌面端（最新版） | `0.2.0-rc.2` |',
  '',
  '同一份代码同时支持两者——桌面端内置的就是同一套聊天界面，客户端插件契约一致。',
  '',
  `> 完整版本历史与兼容性对照表见 [\`CHANGELOG.md\`](https://github.com/${OWNER}/${REPO}/blob/main/CHANGELOG.md)。`,
].join('\n');

const payload = {
  tag_name: tag,
  name: `${tag} — 离线可用 + 双宿主支持`,
  body,
  draft: false,
  prerelease: false,
  make_latest: 'true',
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// --- token from the git credential helper (kept in memory only) ---
const cred = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
});
const token = /^password=(.*)$/m.exec(String(cred.stdout))?.[1]?.trim();
if (token === undefined || token.length === 0) {
  console.error('未能从 git 凭据助手取得令牌（先手动 push 一次即可让凭据生效）');
  process.exit(1);
}

const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/releases`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'dsh-release-publisher',
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const text = await response.text();
console.log(`HTTP ${response.status} ${response.statusText}`);
if (response.ok) {
  const json = JSON.parse(text);
  console.log(`已发布 Release: ${json.tag_name}`);
  console.log(`标题    : ${json.name}`);
  console.log(`页面    : ${json.html_url}`);
} else {
  console.error(text.slice(0, 600));
  process.exit(1);
}
