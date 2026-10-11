window.__ModuleLoader__.load({
	id: "dsh-mermaid-renderer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		//#region lib/types/client/index.js
		/**
		 * dsh-mermaid-renderer 浏览器半。
		 *
		 * 1) 聊天中的 Mermaid 代码块自动渲染为「图表 / 代码」卡片：
		 *    - 连续放大/缩小/还原（width% 缩放 + block 布局，解除 max-width 封顶，
		 *      flex 布局会把超宽 SVG 压缩回去 —— v1.0 只能放大一次的根因）；
		 *    - Ctrl+滚轮 在卡片上快速缩放。
		 * 2) 「⛶」按钮打开独立查看器（挂载在 document.body 的固定浮层，
		 *    不受聊天区 React 重渲染影响）：滚轮绕光标缩放、拖拽平移、
		 *    适应宽度 / 100%、双击适应、ESC 关闭；还可「新标签页打开」
		 *    （Blob URL 自包含页面，含同样的 SVG）。
		 *
		 * Mermaid 引擎按需加载（首个图表出现时才拉取），顺序尝试：
		 *   window.__DSH_MERMAID_URL__（自定义镜像）→ jsDelivr → unpkg → 内联引擎（离线兜底）。
		 * 内联引擎由 scripts/build-client.mjs 嵌入（见文件末尾 INLINE_ENGINE）；
		 * 未嵌入时自动跳过，因此**离线兜底是可选的**，不影响联网使用。
		 *
		 * 同一份代码同时支持命令行网页端与官方桌面端（两者共用同一套网页界面与客户端插件契约）。
		 *
		 * @module dsh-mermaid-renderer/client
		 */
		const VERSION = "1.3.0";
		const WRAP_CLASS = "dsh-mermaid-wrap";
		const DEFAULT_MERMAID_URLS = [
			"https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js",
			"https://unpkg.com/mermaid@11/dist/mermaid.min.js"
		];
		/** 判定代码块的启发式：类名带 mermaid，或文本以常见图表关键字开头。 */
		const DIAGRAM_RE = /^\s*(?:%%\{[^}]*\}%%)?\s*(?:flowchart\s+[A-Z]+|graph\s+[A-Z]+|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|quadrantChart|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|gitGraph|C4Context|requirementDiagram|zenuml)\b/m;
		let mermaid = null;
		let mermaidLoading = null;
		let renderSeq = 0;
		/** 已处理 <pre> 的登记表（Set 便于在 React 还原原始节点时回收并重渲染）。 */
		const processed = new Set();
		/** 已注入的样式元素（卸载时交还给宿主清理）。 */
		let styleEl = null;
		/**
		 * 注入样式（幂等）。样式元素登记在 styleEl 上，由 apply 里的
		 * ctx.effect 负责移除——插件卸载后页面不留残余样式。
		 */
		function ensureStyles() {
			if (styleEl && styleEl.isConnected) return;
			const style = document.createElement("style");
			style.setAttribute("data-plugin", "dsh-mermaid-renderer");
			style.textContent = [
				`.${WRAP_CLASS}{margin:10px 0;border:1px solid rgba(128,128,128,.32);border-radius:10px;overflow:hidden;background:rgba(128,128,128,.04)}`,
				`.dsh-mermaid-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:4px 8px;border-bottom:1px solid rgba(128,128,128,.22);font-size:11px;opacity:.85}`,
				`.dsh-mermaid-head .dsh-mm-label{font-weight:600}`,
				`.dsh-mermaid-head button{border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;border-radius:6px;padding:2px 9px;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.6}`,
				`.dsh-mermaid-head button:hover{opacity:1;border-color:rgba(128,128,128,.7)}`,
				`.dsh-mermaid-head button.dsh-mm-on{background:rgba(96,165,250,.22);border-color:rgba(96,165,250,.5)}`,
				`.dsh-mermaid-body{padding:10px;overflow:auto;max-height:72vh}`,
				`.dsh-mermaid-body>pre{margin:0}`,
				/* block 布局：超宽 SVG 直接溢出并横向滚动，绝不回缩 */
				`.dsh-mermaid-svg{min-width:100%;position:relative;user-select:none;-webkit-user-select:none}`,
				`.dsh-mermaid-svg svg{display:block;margin:0 auto;max-width:100%;height:auto}`,
				`.dsh-mermaid-err{color:#f87171;font-size:12px;padding:8px;white-space:pre-wrap;text-align:left}`,
				`.dsh-mermaid-err button{margin-top:6px;border:1px solid rgba(248,113,113,.5);background:transparent;color:inherit;border-radius:6px;padding:2px 10px;font-size:11px;cursor:pointer}`,
				/* ── 独立查看器（全屏浮层） ── */
				`.dsh-mm-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(8,10,14,.66);display:flex;align-items:stretch;justify-content:stretch;padding:2vh 2vw;user-select:none;-webkit-user-select:none}`,
				`.dsh-mm-panel{flex:1;display:flex;flex-direction:column;background:#fafbfc;color:#1f2328;border-radius:12px;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,.45)}`,
				`.dsh-mm-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid rgba(128,128,128,.25);font-size:12px}`,
				`.dsh-mm-head .dsh-mm-title{font-weight:600;margin-right:auto}`,
				`.dsh-mm-head button{border:1px solid rgba(128,128,128,.45);background:#fff;color:#1f2328;border-radius:6px;padding:3px 10px;font-size:12px;cursor:pointer;font-family:inherit;line-height:1.6}`,
				`.dsh-mm-head button:hover{border-color:rgba(128,128,128,.8);background:#f0f2f5}`,
				`.dsh-mm-head .dsh-mm-pct{min-width:52px;text-align:center;font-variant-numeric:tabular-nums;opacity:.85}`,
				`.dsh-mm-canvas{flex:1;overflow:auto;position:relative;background:#eef0f3;cursor:grab;touch-action:none}`,
				`.dsh-mm-canvas.dsh-mm-drag{cursor:grabbing}`,
				`.dsh-mm-stage{position:absolute;top:12px;left:12px;transform-origin:0 0;will-change:transform}`,
				`.dsh-mm-stage svg{display:block;max-width:none;height:auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.18);border-radius:4px}`
			].join("");
			document.head.appendChild(style);
			styleEl = style;
		}
		/**
		 * 应用全局美化默认值：只影响「观感」（字号/间距/颜色/曲率），
		 * 不改变图的结构布局；每张图自己的 %%{init}%% 指令会覆盖这里。
		 */
		function initEngine(engine) {
			engine.initialize({
				startOnLoad: false,
				theme: "default",
				flowchart: {
					htmlLabels: true,
					curve: "basis",
					nodeSpacing: 55,
					rankSpacing: 60,
					padding: 8
				},
				securityLevel: "strict",
				themeVariables: {
					fontSize: "15px",
					fontFamily: "'Segoe UI', 'Microsoft YaHei', system-ui, sans-serif",
					lineColor: "#7c8794",
					edgeLabelBackground: "#f6f7f9",
					primaryColor: "#eef1f4",
					primaryBorderColor: "#8b98a5",
					primaryTextColor: "#1f2328",
					tertiaryColor: "#f7f8fa"
				}
			});
			return engine;
		}
		/** CDN 加载超时：离线时不要傻等浏览器默认的长时间超时。 */
		const CDN_TIMEOUT_MS = 8000;
		/** 启动内联引擎（随本文件一起分发，无需联网；见文件末尾 INLINE_ENGINE）。 */
		function loadInlineEngine() {
			try {
				if (typeof INLINE_ENGINE !== "function") return null;
				INLINE_ENGINE();
				const engine = window.mermaid;
				if (!engine) return null;
				return initEngine(engine);
			} catch (error) {
				console.warn("[dsh-mermaid-renderer] 内联引擎启动失败", error);
				return null;
			}
		}
		/**
		 * 通过 <script src> 加载一个外部引擎地址。
		 * @returns 成功时 resolve 引擎；超时或网络失败时 resolve null（不 reject）。
		 */
		function loadFromUrl(url) {
			return new Promise((resolve) => {
				const script = document.createElement("script");
				let settled = false;
				const finish = (engine) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					resolve(engine);
				};
				const timer = setTimeout(() => {
					console.warn("[dsh-mermaid-renderer] 加载超时，换下一个源：" + url);
					finish(null);
				}, CDN_TIMEOUT_MS);
				script.src = url;
				script.onload = () => {
					try {
						finish(initEngine(window.mermaid));
					} catch (error) {
						console.warn("[dsh-mermaid-renderer] Mermaid 初始化失败", error);
						finish(null);
					}
				};
				script.onerror = () => finish(null);
				document.head.appendChild(script);
			});
		}
		/**
		 * 惰性加载 Mermaid 引擎。顺序：
		 *   1) window.__DSH_MERMAID_URL__（用户自定义镜像）
		 *   2) jsDelivr → unpkg（联网，最快，不占插件体积）
		 *   3) 内联引擎（随 client.js 分发，**离线可用**）
		 * 全部失败才返回 null；结果会被缓存，不会重复尝试。
		 */
		async function loadMermaid() {
			if (mermaid) return mermaid;
			if (mermaidLoading) return mermaidLoading;
			mermaidLoading = (async () => {
				const urls = [];
				if (typeof window.__DSH_MERMAID_URL__ === "string" && window.__DSH_MERMAID_URL__) urls.push(window.__DSH_MERMAID_URL__);
				urls.push(...DEFAULT_MERMAID_URLS);
				for (const url of urls) {
					const engine = await loadFromUrl(url);
					if (engine) {
						mermaid = engine;
						return mermaid;
					}
				}
				// 走到这里说明全部外部源都不可用——离线或网络受限，改用内联引擎。
				console.info("[dsh-mermaid-renderer] 外部源均不可用，改用内联引擎（离线模式）");
				const inline = loadInlineEngine();
				if (inline) {
					mermaid = inline;
					return mermaid;
				}
				console.warn("[dsh-mermaid-renderer] Mermaid 引擎加载失败：外部源不可用且内联引擎缺失");
				return null;
			})();
			return mermaidLoading;
		}
		function looksLikeMermaid(pre) {
			const code = pre.querySelector("code") || pre;
			const cls = (code.className || "") + " " + (pre.className || "");
			if (/\bmermaid\b/i.test(cls)) return true;
			return DIAGRAM_RE.test(code.textContent || "");
		}
		function textOf(pre) {
			const code = pre.querySelector("code") || pre;
			return code.textContent || "";
		}
		//#region viewer
		/** 独立查看器（全屏浮层）：滚轮绕光标缩放 + 拖拽平移 + 适应宽度。 */
		let viewer = null;
		function closeViewer() {
			if (viewer) {
				viewer.overlay.remove();
				document.removeEventListener("keydown", viewer.onKey);
				document.body.style.overflow = viewer.prevOverflow;
				viewer = null;
			}
		}
		/** 打开查看器；svgMarkup 为已渲染 SVG 字符串，title 用于页签与浮层标题。 */
		function openViewer(svgMarkup, title) {
			closeViewer();
			const overlay = document.createElement("div");
			overlay.className = "dsh-mm-overlay";
			const panel = document.createElement("div");
			panel.className = "dsh-mm-panel";
			const head = document.createElement("div");
			head.className = "dsh-mm-head";
			const titleEl = document.createElement("span");
			titleEl.className = "dsh-mm-title";
			titleEl.textContent = title || "Mermaid 图表";
			const pct = document.createElement("span");
			pct.className = "dsh-mm-pct";
			const btnOut = document.createElement("button");
			btnOut.textContent = "➖";
			btnOut.title = "缩小（滚轮）";
			const btnIn = document.createElement("button");
			btnIn.textContent = "➕";
			btnIn.title = "放大（滚轮）";
			const btnFit = document.createElement("button");
			btnFit.textContent = "适应宽度";
			const btn100 = document.createElement("button");
			btn100.textContent = "100%";
			const btnTab = document.createElement("button");
			btnTab.textContent = "新标签页打开";
			const btnClose = document.createElement("button");
			btnClose.textContent = "✕ 关闭";
			head.append(titleEl, pct, btnOut, btnIn, btnFit, btn100, btnTab, btnClose);
			const canvas = document.createElement("div");
			canvas.className = "dsh-mm-canvas";
			const stage = document.createElement("div");
			stage.className = "dsh-mm-stage";
			stage.innerHTML = svgMarkup;
			const svg = stage.querySelector("svg");
			let naturalW = null;
			let naturalH = null;
			if (svg) {
				// mermaid(useMaxWidth) 的内联 max-width 像素值 = 图表的自然宽度
				const mw = svg.style.maxWidth;
				if (mw) naturalW = parseFloat(mw) || null;
				const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
				if (naturalW !== null && vb.length === 4 && vb[2]) naturalH = naturalW * vb[3] / vb[2];
				svg.style.maxWidth = "none";
				svg.style.width = naturalW !== null ? naturalW + "px" : "100%";
				svg.style.height = naturalH !== null ? naturalH + "px" : "auto";
			}
			canvas.appendChild(stage);
			panel.append(head, canvas);
			overlay.appendChild(panel);
			let scale = 1;
			let tx = 0;
			let ty = 0;
			const clampScale = (s) => Math.min(10, Math.max(0.05, s));
			const apply = () => {
				stage.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
				pct.textContent = Math.round(scale * 100) + "%";
			};
			const zoomBy = (factor, cx, cy) => {
				const next = clampScale(scale * factor);
				if (cx !== void 0 && cy !== void 0) {
					// 保持光标下的点不动：世界坐标 w=(p-t)/s
					tx = cx - (cx - tx) * (next / scale);
					ty = cy - (cy - ty) * (next / scale);
				}
				scale = next;
				apply();
			};
			const fitWidth = () => {
				const cw = canvas.clientWidth - 32;
				const ch = canvas.clientHeight - 32;
				const natW = naturalW || 600;
				const natH = naturalH || 400;
				scale = clampScale(Math.min(cw / natW, ch / natH));
				tx = 12;
				ty = 12;
				apply();
			};
			// 滚轮：绕光标缩放
			canvas.addEventListener("wheel", (event) => {
				event.preventDefault();
				const rect = canvas.getBoundingClientRect();
				zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1, event.clientX - rect.left, event.clientY - rect.top);
			}, { passive: false });
			// 拖拽平移
			let dragging = false;
			let startX = 0;
			let startY = 0;
			let baseTx = 0;
			let baseTy = 0;
			canvas.addEventListener("pointerdown", (event) => {
				if (event.button !== 0) return;
				// 点击即清除页面上残留的文本选中，避免出现蓝色多选高亮
				if (window.getSelection) window.getSelection().removeAllRanges();
				dragging = true;
				canvas.classList.add("dsh-mm-drag");
				canvas.setPointerCapture(event.pointerId);
				startX = event.clientX;
				startY = event.clientY;
				baseTx = tx;
				baseTy = ty;
			});
			canvas.addEventListener("pointermove", (event) => {
				if (!dragging) return;
				tx = baseTx + event.clientX - startX;
				ty = baseTy + event.clientY - startY;
				apply();
			});
			const endDrag = (event) => {
				if (!dragging) return;
				dragging = false;
				canvas.classList.remove("dsh-mm-drag");
				try {
					canvas.releasePointerCapture(event.pointerId);
				} catch {}
			};
			canvas.addEventListener("pointerup", endDrag);
			canvas.addEventListener("pointercancel", endDrag);
			canvas.addEventListener("dblclick", () => fitWidth());
			btnOut.addEventListener("click", () => {
				const rect = canvas.getBoundingClientRect();
				zoomBy(1 / 1.25, rect.width / 2, rect.height / 2);
			});
			btnIn.addEventListener("click", () => {
				const rect = canvas.getBoundingClientRect();
				zoomBy(1.25, rect.width / 2, rect.height / 2);
			});
			btnFit.addEventListener("click", () => fitWidth());
			btn100.addEventListener("click", () => {
				scale = 1;
				tx = 12;
				ty = 12;
				apply();
			});
			btnTab.addEventListener("click", () => {
				const html = [
					"<!doctype html><html><head><meta charset=\"utf-8\">",
					"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
					"<title>", title || "Mermaid 图表", "</title>",
					"<style>",
					"body{margin:0;background:#eef0f3;color:#1f2328;font-family:system-ui,'Segoe UI','Microsoft YaHei',sans-serif}",
					".bar{padding:8px 14px;font-size:13px;border-bottom:1px solid rgba(128,128,128,.25);background:#fafbfc}",
					".box{padding:16px;overflow:auto}",
					"svg{display:block;max-width:none;height:auto;background:#fff;border-radius:4px;box-shadow:0 2px 14px rgba(0,0,0,.15)}",
					"</style></head><body>",
					"<div class=\"bar\">📊 ", title || "Mermaid 图表", "　·　Ctrl+滚轮可缩放页面　·　浏览器缩放可看全局</div>",
					"<div class=\"box\">", svgMarkup, "</div>",
					"</body></html>"
				].join("");
				const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
				window.open(url, "_blank");
			});
			btnClose.addEventListener("click", () => closeViewer());
			overlay.addEventListener("pointerdown", (event) => {
				if (event.target === overlay) closeViewer();
			});
			const onKey = (event) => {
				if (event.key === "Escape") {
					closeViewer();
				} else if (event.key === "+" || event.key === "=") {
					const rect = canvas.getBoundingClientRect();
					zoomBy(1.25, rect.width / 2, rect.height / 2);
				} else if (event.key === "-") {
					const rect = canvas.getBoundingClientRect();
					zoomBy(1 / 1.25, rect.width / 2, rect.height / 2);
				} else if (event.key === "0") {
					scale = 1;
					tx = 12;
					ty = 12;
					apply();
				}
			};
			document.addEventListener("keydown", onKey);
			viewer = {
				overlay,
				onKey,
				prevOverflow: document.body.style.overflow
			};
			document.body.style.overflow = "hidden";
			document.body.appendChild(overlay);
			// 首帧：适应宽度，方便全局观看
			requestAnimationFrame(() => {
				fitWidth();
			});
		}
		//#endregion
		/**
		 * 把一个 <pre> 包装为图表卡片。返回后卡片默认处于「图表」视图，
		 * Mermaid 引擎到达后再渲染；引擎不可用时显示错误提示并保留代码视图。
		 */
		async function processBlock(pre) {
			if (processed.has(pre)) return;
			processed.add(pre);
			const parent = pre.parentElement;
			if (!parent || !document.body.contains(parent)) return;
			const wrap = document.createElement("div");
			wrap.className = WRAP_CLASS;
			wrap.setAttribute("data-dsh-mm-version", VERSION);
			const head = document.createElement("div");
			head.className = "dsh-mermaid-head";
			const label = document.createElement("span");
			label.className = "dsh-mm-label";
			label.textContent = "📊 Mermaid";
			const btnDiagram = document.createElement("button");
			btnDiagram.type = "button";
			btnDiagram.textContent = "图表";
			const btnCode = document.createElement("button");
			btnCode.type = "button";
			btnCode.textContent = "代码";
			const btnCopy = document.createElement("button");
			btnCopy.type = "button";
			btnCopy.textContent = "复制源码";
			const btnView = document.createElement("button");
			btnView.type = "button";
			btnView.textContent = "⛶ 查看大图";
			btnView.title = "在独立查看器中打开（可放到任意大小全局观看）";
			btnView.disabled = true;
			const btnOut = document.createElement("button");
			btnOut.type = "button";
			btnOut.textContent = "➖";
			btnOut.title = "缩小（或 Ctrl+滚轮）";
			const btnReset = document.createElement("button");
			btnReset.type = "button";
			btnReset.textContent = "↺";
			btnReset.title = "还原缩放";
			const btnIn = document.createElement("button");
			btnIn.type = "button";
			btnIn.textContent = "➕";
			btnIn.title = "放大（或 Ctrl+滚轮）";
			head.append(label, btnDiagram, btnCode, btnCopy, btnView, btnOut, btnReset, btnIn);
			const body = document.createElement("div");
			body.className = "dsh-mermaid-body";
			const svgBox = document.createElement("div");
			svgBox.className = "dsh-mermaid-svg";
			body.appendChild(svgBox);
			parent.replaceChild(wrap, pre);
			wrap.append(head, body);
			body.appendChild(pre); // 代码视图必须留在卡片内
			let scale = 1;
			let lastText = textOf(pre);
			let rendering = false;
			let rerenderWanted = false;
			let lastSvgMarkup = null;
			let renderTimer = null;
			/** 应用缩放：width% + block 布局，解除 max-width 封顶 —— 可连续多次放大。 */
			function applyZoom() {
				const svg = svgBox.querySelector("svg");
				if (!svg) return;
				svg.style.maxWidth = "none";
				svg.style.width = 100 * scale + "%";
			}
			function setScale(next) {
				scale = Math.min(4, Math.max(0.25, Math.round(next * 4) / 4));
				applyZoom();
			}
			async function renderNow() {
				if (!lastText || !lastText.trim()) return; // 空文本（页面重渲染的瞬间）不渲染，等文字到位后由防抖触发
				if (rendering) {
					rerenderWanted = true;
					return;
				}
				const engine = await loadMermaid();
				if (!engine) {
					showError("⚠️ 无法加载 Mermaid 渲染引擎（需要联网，或通过 window.__DSH_MERMAID_URL__ 指定可用地址）。\n你仍可在「代码」标签下查看源码。");
					return;
				}
				rendering = true;
				const mySeq = ++renderSeq;
				try {
					const { svg } = await engine.render("dsh-mermaid-" + mySeq + "-" + Date.now(), lastText);
					svgBox.innerHTML = svg;
					lastSvgMarkup = svg;
					btnView.disabled = false;
					applyZoom();
				} catch (error) {
					showError("⚠️ Mermaid 渲染失败：" + (error && error.message ? error.message : String(error)));
				} finally {
					rendering = false;
					if (rerenderWanted) {
						rerenderWanted = false;
						renderNow();
					}
				}
			}
			function showError(message) {
				const note = document.createElement("div");
				note.className = "dsh-mermaid-err";
				note.textContent = message;
				const retry = document.createElement("button");
				retry.type = "button";
				retry.textContent = "重试";
				retry.onclick = () => {
					note.remove();
					renderNow();
				};
				note.appendChild(retry);
				svgBox.innerHTML = "";
				svgBox.appendChild(note);
			}
			/** 防抖渲染：等文字稳定 500ms 再画，避免流式输出时对半截图反复报错。 */
			function scheduleRender() {
				clearTimeout(renderTimer);
				renderTimer = setTimeout(() => renderNow(), 500);
			}
			function show(mode) {
				const isDiagram = mode === "diagram";
				btnDiagram.classList.toggle("dsh-mm-on", isDiagram);
				btnCode.classList.toggle("dsh-mm-on", !isDiagram);
				svgBox.style.display = isDiagram ? "" : "none";
				pre.style.display = isDiagram ? "none" : "";
				if (isDiagram) scheduleRender();
			}
			btnDiagram.addEventListener("click", () => show("diagram"));
			btnCode.addEventListener("click", () => show("code"));
			btnCopy.addEventListener("click", () => {
				navigator.clipboard.writeText(lastText).then(() => {
					btnCopy.textContent = "已复制 ✓";
					setTimeout(() => {
						btnCopy.textContent = "复制源码";
					}, 1200);
				}).catch(() => {
					btnCopy.textContent = "复制失败";
					setTimeout(() => {
						btnCopy.textContent = "复制源码";
					}, 1200);
				});
			});
			btnView.addEventListener("click", () => {
				if (lastSvgMarkup) openViewer(lastSvgMarkup, "Mermaid 图表");
			});
			btnIn.addEventListener("click", () => setScale(scale + 0.25));
			btnOut.addEventListener("click", () => setScale(scale - 0.25));
			btnReset.addEventListener("click", () => setScale(1));
			// Ctrl+滚轮：卡片内快速缩放
			body.addEventListener("wheel", (event) => {
				if (!event.ctrlKey || pre.style.display !== "none") return;
				event.preventDefault();
				setScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
			}, { passive: false });
			// 默认图表视图（引擎懒加载）
			pre.style.display = "none";
			show("diagram");
			// 流式更新 / 内容变化时重渲染
			const observer = new MutationObserver(() => {
				const next = textOf(pre);
				if (next !== lastText) {
					lastText = next;
					if (btnDiagram.classList.contains("dsh-mm-on")) scheduleRender();
				}
			});
			observer.observe(pre, { characterData: true, childList: true, subtree: true });
		}
		/** 扫描页面：处理新出现的 mermaid 代码块；React 还原的原始 <pre> 重新包装。 */
		function scan() {
			for (const pre of document.querySelectorAll("pre")) {
				if (pre.closest("." + WRAP_CLASS)) continue;
				if (processed.has(pre)) {
					processed.delete(pre);
				}
				try {
					if (looksLikeMermaid(pre)) processBlock(pre);
				} catch (error) {
					console.warn("[dsh-mermaid-renderer] 处理代码块失败", error);
				}
			}
		}
		/** Cordis 客户端插件入口。 */
		function apply(ctx) {
			// 样式、定时器、DOM 监听统一登记在本 effect 内：插件卸载 = 全部清理干净。
			ctx.effect(() => {
				ensureStyles();
				// HMR 热更新后：拆除旧版本卡片（旧卡片无 ⛶ 按钮/有缩放 bug），重新包装
				for (const wrap of document.querySelectorAll("." + WRAP_CLASS)) {
					if (wrap.getAttribute("data-dsh-mm-version") === VERSION) continue;
					const oldPre = wrap.querySelector("pre");
					const wrapParent = wrap.parentElement;
					if (oldPre && wrapParent) {
						wrapParent.replaceChild(oldPre, wrap);
						processed.delete(oldPre);
					}
				}
				scan();
				// 兜底补扫 + DOM 变更监听，随插件卸载一并清理
				const timer = setInterval(scan, 2000);
				const observer = new MutationObserver(scan);
				observer.observe(document.body, { childList: true, subtree: true, characterData: true });
				return () => {
					clearInterval(timer);
					observer.disconnect();
					if (styleEl && styleEl.isConnected && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
					styleEl = null;
				};
			});
			// 调试 / 二次开发钩子
			window.__DSH_MERMAID__ = {
				version: VERSION,
				scan,
				loaded: () => mermaid !== null,
				blockCount: () => processed.size,
				closeViewer
			};
			console.info(`[dsh-mermaid-renderer] v${VERSION} 已启用：聊天中的 Mermaid 代码块将自动渲染`);
		}
		//#region INLINE_ENGINE
		/**
		 * 内联 Mermaid 引擎占位。
		 *
		 * 由 `scripts/build-client.mjs` 把 `.vendor/mermaid.min.js` 整体嵌入到这里
		 * （直接作为函数体，不做字符串转义，因此反引号/模板串都安全）。
		 * 未嵌入时此函数返回 undefined，loadInlineEngine() 会跳过它——
		 * 也就是说**离线兜底是可选的**，缺了不影响联网使用。
		 */
		function INLINE_ENGINE() {}
		//#endregion INLINE_ENGINE
		exports.VERSION = VERSION;
		exports.apply = apply;
		exports.name = "mermaid-renderer";
		return module.exports;
		//#endregion
	}
});
