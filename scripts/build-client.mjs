/**
 * Build `lib/client.js` by embedding the Mermaid engine into the client template.
 *
 * Why a build step: the plugin ships a hand-written static bundle, and the
 * offline engine must live INSIDE that bundle — DSH serves exactly one asset per
 * plugin (`client.js`), and the manifest has no field for extra files, so a
 * second lazily-fetched file is not possible.
 *
 * The engine is spliced in as a function BODY (not as a string), so backticks,
 * template literals and quotes inside mermaid.min.js need no escaping.
 *
 * Layout:
 *   lib/client.src.js         hand-editable template, contains the placeholder
 *   .vendor/mermaid.min.js    vendored engine (committed, so builds are offline)
 *   lib/client.js             GENERATED — never edit by hand
 *
 * Usage:
 *   node scripts/build-client.mjs            # rebuild lib/client.js
 *   node scripts/build-client.mjs --check    # verify lib/client.js is up to date
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TEMPLATE = join(ROOT, 'lib', 'client.src.js');
const VENDOR = join(ROOT, '.vendor', 'mermaid.min.js');
const OUTPUT = join(ROOT, 'lib', 'client.js');

const START = '//#region INLINE_ENGINE';
const END = '//#endregion INLINE_ENGINE';
const PLACEHOLDER = /function INLINE_ENGINE\(\) \{\}/;

const checkOnly = process.argv.includes('--check');

for (const [label, path] of [['模板', TEMPLATE], ['引擎', VENDOR]]) {
  if (!existsSync(path)) {
    console.error(`找不到${label}：${path}`);
    process.exit(1);
  }
}

const template = readFileSync(TEMPLATE, 'utf8');
const engine = readFileSync(VENDOR, 'utf8');

if (!template.includes(START) || !template.includes(END)) {
  console.error(`模板缺少 INLINE_ENGINE 区块标记（${START} … ${END}）`);
  process.exit(1);
}

const startAt = template.indexOf(START);
const endAt = template.indexOf(END, startAt);
if (endAt < 0) {
  console.error('INLINE_ENGINE 区块未闭合');
  process.exit(1);
}

const head = template.slice(0, startAt);
const tail = template.slice(endAt);

// The engine becomes the function body. `globalThis.mermaid` is what the engine
// itself assigns at its end, so no wrapper beyond the function is needed.
const block = [
  START,
  '\t\t/**',
  '\t\t * 内联 Mermaid 引擎 —— 由 scripts/build-client.mjs 从 .vendor/mermaid.min.js 嵌入。',
  '\t\t * 不要手改本区块：改 .vendor 或模板后重新运行构建脚本。',
  '\t\t */',
  `\t\tfunction INLINE_ENGINE() {\n${engine}\n\t\t}`,
  '',
].join('\n');

let output = head + block + tail;

// The generated file must not carry the template's placeholder any more.
if (PLACEHOLDER.test(output.replace(engine, ''))) {
  console.error('嵌入后仍检测到占位函数，构建中止');
  process.exit(1);
}

// Sanity: the engine assigns the global the loader reads.
if (!output.includes('globalThis["mermaid"]')) {
  console.warn('⚠️ 引擎末尾未见 globalThis["mermaid"] 赋值，请确认版本兼容');
}

const sha = (text) => createHash('sha256').update(text).digest('hex');
const report = {
  template: `${(Buffer.byteLength(template) / 1024).toFixed(1)} KB`,
  engine: `${(Buffer.byteLength(engine) / 1048576).toFixed(2)} MB`,
  output: `${(Buffer.byteLength(output) / 1048576).toFixed(2)} MB`,
  engineSha256: sha(engine),
  outputSha256: sha(output),
};

if (checkOnly) {
  const current = existsSync(OUTPUT) ? readFileSync(OUTPUT, 'utf8') : '';
  const upToDate = sha(current) === report.outputSha256;
  console.log(JSON.stringify({ ...report, upToDate }, null, 2));
  console.log(upToDate ? 'OK：lib/client.js 与模板+引擎一致' : 'STALE：请重新运行构建');
  process.exitCode = upToDate ? 0 : 1;
} else {
  writeFileSync(OUTPUT, output, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`已写出 ${OUTPUT}`);
}
