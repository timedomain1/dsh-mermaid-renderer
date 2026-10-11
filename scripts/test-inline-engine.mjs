/**
 * Prove the inline engine in the built bundle actually initializes.
 *
 * Extraction strategy: rather than brace-matching 3.4 MB of minified code
 * (regex-vs-division is undecidable without a real parser), split the bundle on
 * the engine's own last statement — `globalThis["mermaid"] = …` — which is
 * asserted to exist at build time. Everything from the INLINE_ENGINE region
 * marker to that statement is the engine.
 *
 * The engine body is then executed in a sandbox whose `window` IS `globalThis`,
 * because that final statement assigns to `globalThis`. Success = the global
 * `mermaid` appears and `initialize()` runs.
 *
 * Usage: node scripts/test-inline-engine.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(HERE, '..', 'lib', 'client.js');
const source = readFileSync(CLIENT, 'utf8');

const REGION = '//#region INLINE_ENGINE';
const OPENER = 'function INLINE_ENGINE() {';
const ANCHOR = 'globalThis["mermaid"]';

const regionAt = source.indexOf(REGION);
const openAt = regionAt < 0 ? -1 : source.indexOf(OPENER, regionAt);
const anchorAt = source.indexOf(ANCHOR, openAt);
if (regionAt < 0 || openAt < 0 || anchorAt < 0) {
  console.error(`切分锚点缺失：region=${regionAt} opener=${openAt} anchor=${anchorAt}`);
  process.exit(1);
}

// Engine text = function body up to and including the final assignment line.
const afterOpener = openAt + OPENER.length;
const lineEnd = source.indexOf('\n', anchorAt);
const body = source.slice(afterOpener, lineEnd < 0 ? anchorAt + ANCHOR.length + 8 : lineEnd);

console.log(`引擎函数体长度 : ${(Buffer.byteLength(body) / 1048576).toFixed(2)} MB`);
console.log(`末尾 90 字符   : ${body.trimEnd().slice(-90)}`);

// ---- minimal browser sandbox; window IS globalThis ----
// Some globals (navigator, location) are getter-only accessors in modern Node,
// so define them through defineProperty instead of plain assignment.
function define(name, value) {
  try {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true, enumerable: true });
  } catch (error) {
    console.warn(`  (跳过 ${name}: ${error.message})`);
  }
}

const g = globalThis;
const fakeElement = () => ({
  style: {}, attributes: {},
  setAttribute() {}, getAttribute: () => null,
  appendChild() {}, removeChild() {}, insertBefore() {},
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [],
  children: [], classList: { add() {}, remove() {}, contains: () => false },
});
define('window', g);
define('self', g);
define('document', {
  head: fakeElement(), body: fakeElement(), documentElement: fakeElement(),
  createElement: fakeElement, createElementNS: fakeElement,
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener() {}, removeEventListener() {},
  readyState: 'complete', currentScript: null,
});
define('navigator', { userAgent: 'node', language: 'zh-CN', languages: ['zh-CN'] });
define('location', { href: 'http://localhost/', protocol: 'http:' });
define('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
define('requestAnimationFrame', (fn) => setTimeout(fn, 0));
define('cancelAnimationFrame', (id) => clearTimeout(id));
define('getComputedStyle', () => ({ getPropertyValue: () => '' }));
define('addEventListener', () => {});
define('removeEventListener', () => {});
define('dispatchEvent', () => true);
define('HTMLIFrameElement', function HTMLIFrameElement() {});
define('DOMParser', class DOMParser {
  parseFromString() {
    return { documentElement: fakeElement(), querySelector: () => null, querySelectorAll: () => [] };
  }
});

console.log('\n执行引擎…');
try {
  // The engine declares its namespace with a top-level `var`, and its last
  // statement reads that var back off `globalThis`. `new Function` would make
  // the var function-local and break that read, so evaluate in the true global
  // scope with runInThisContext — exactly how a classic <script> behaves.
  const vm = await import('node:vm');
  vm.runInThisContext(body, { filename: 'inline-mermaid-engine.js' });
  const engine = g.mermaid;
  if (engine === undefined || engine === null) {
    console.error('❌ 引擎执行完毕但未挂载 globalThis.mermaid');
    process.exit(1);
  }
  console.log('✅ 已挂载 globalThis.mermaid');
  console.log(`   initialize : ${typeof engine.initialize === 'function' ? '函数 ✅' : '缺失 ❌'}`);
  console.log(`   render     : ${typeof engine.render === 'function' ? '函数 ✅' : '缺失 ❌'}`);
  const version = engine.version ?? engine.mermaidVersion;
  console.log(`   版本自述   : ${version ?? '(未暴露)'}`);
  if (typeof engine.initialize === 'function') {
    engine.initialize({ startOnLoad: false, securityLevel: 'strict' });
    console.log('✅ engine.initialize() 调用成功（与插件离线路径一致）');
  }
  if (typeof engine.render !== 'function') process.exit(1);
} catch (error) {
  console.error(`❌ 引擎执行抛错: ${error.message}`);
  const frame = String(error.stack ?? '').split('\n')[1] ?? '';
  console.error(`   ${frame.trim()}`);
  process.exit(1);
}
