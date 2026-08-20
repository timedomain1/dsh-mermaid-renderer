//#region lib/types/index.js
/**
 * dsh-mermaid-renderer 宿主半（Node）。
 *
 * 纯 UI 插件：宿主侧无行为，空 apply 的作用只是让本插件出现在宿主
 * cordis 组合 / Loader 中；浏览器半通过 exports["./client"] 提供，
 * 由 package.json 的 dsh.client 声明发现（见 @deepseek-ai/dsh-client-modules）。
 *
 * @module dsh-mermaid-renderer
 */
/** 宿主插件主体 —— 无宿主侧行为。 */
function apply() {}
//#endregion
export { apply };
