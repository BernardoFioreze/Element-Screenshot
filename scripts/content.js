(() => {
  // ─── Estado ───────────────────────────────────────────────────────────────
  let isActive = false;
  let hoveredElement = null;

  const HIGHLIGHT_STYLE_ID = "ess-highlight-style";
  const HIGHLIGHT_CLASS = "ess-highlight";
  const OVERLAY_ID = "ess-overlay";

  // ─── Injeção de estilos ───────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIGHLIGHT_STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: none !important;
        box-shadow:
          0 0 0 2px #cba6f7,
          0 0 0 4px rgba(203, 166, 247, 0.25),
          0 0 16px 3px rgba(203, 166, 247, 0.35) !important;
        border-radius: 3px !important;
        cursor: crosshair !important;
        transition:
          box-shadow 0.15s ease,
          border-radius 0.15s ease !important;
      }

      #ess-label {
        position: fixed;
        background: #cba6f7;
        color: #1e1e2e;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 9px 3px 7px;
        border-radius: 4px;
        pointer-events: none;
        z-index: 2147483647;
        white-space: nowrap;
        display: none;
        font-family: ui-monospace, "Cascadia Code", "Fira Code", monospace;
        letter-spacing: 0.2px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.35);
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 0.12s ease, transform 0.12s ease;
      }

      #ess-label.visible {
        opacity: 1;
        transform: translateY(0);
      }

      #ess-toast {
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(16px);
        background: #a6e3a1;
        color: #1e1e2e;
        font-size: 13px;
        font-weight: 600;
        padding: 10px 20px;
        border-radius: 8px;
        z-index: 2147483647;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        pointer-events: none;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        letter-spacing: 0.1px;
      }

      #ess-toast.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }

      #ess-toast.error {
        background: #f38ba8;
      }

      body.ess-active * {
        cursor: crosshair !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────
  function getOrCreate(id, tag) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement(tag);
      el.id = id;
      document.body.appendChild(el);
    }
    return el;
  }

  function updateLabel(el) {
    const label = getOrCreate("ess-label", "div");
    const rect = el.getBoundingClientRect();
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList.length
      ? "." + [...el.classList].filter((c) => !c.startsWith("ess-")).slice(0, 2).join(".")
      : "";
    label.textContent = `${tag}${id}${cls}`;
    label.style.display = "block";

    // Posição: acima do elemento; se não couber, abaixo
    const top = rect.top - 26;
    label.style.top = `${top < 4 ? rect.bottom + 6 : top}px`;
    label.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 200))}px`;

    // Pequeno delay para o display:block ser processado antes da transição
    requestAnimationFrame(() => label.classList.add("visible"));
  }

  function hideLabel() {
    const label = document.getElementById("ess-label");
    if (!label) return;
    label.classList.remove("visible");
    // Esconde após a transição terminar
    setTimeout(() => { if (!label.classList.contains("visible")) label.style.display = "none"; }, 130);
  }

  let toastTimer = null;
  function showToast(message, isError = false) {
    const toast = getOrCreate("ess-toast", "div");
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
  }

  // ─── Utilitários de URL ───────────────────────────────────────────────────
  function resolveUrl(src) {
    if (!src) return null;
    if (src.startsWith("//")) return `https:${src}`;
    if (src.startsWith("http")) return src;
    try {
      return new URL(src, location.href).href;
    } catch {
      return null;
    }
  }

  function generateFilename(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `_${el.id}` : "";
    const cls = el.classList.length
      ? `_${[...el.classList].filter((c) => !c.startsWith("ess-"))[0] || ""}`
      : "";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return `ess_${tag}${id}${cls}_${timestamp}.png`;
  }

  function triggerDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    a.setAttribute("data-ess-download", "1"); // marca para não ser interceptado
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 1000);
  }

  // ─── Estratégia 1a: fetch CORS ────────────────────────────────────────────
  async function fetchBlob(src) {
    // Tenta CORS primeiro; se falhar, tenta no-cors (blob opaco — funciona para download)
    try {
      const resp = await fetch(src, { mode: "cors", credentials: "omit" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.blob();
    } catch (_) {}

    try {
      const resp = await fetch(src, { mode: "no-cors", credentials: "omit" });
      // blob opaco: type vazio mas dados presentes
      const blob = await resp.blob();
      if (blob.size > 0) return blob;
    } catch (_) {}

    return null;
  }

  // ─── Estratégia 1b: canvas nativo para <img> já carregada no DOM ──────────
  async function captureImgWithNativeCanvas(imgEl) {
    return new Promise((resolve) => {
      // Garante que a imagem está carregada
      const draw = () => {
        try {
          const scale = Math.min(window.devicePixelRatio || 1, 2);
          const w = imgEl.naturalWidth || imgEl.offsetWidth;
          const h = imgEl.naturalHeight || imgEl.offsetHeight;
          if (!w || !h) { resolve(false); return; }

          const canvas = document.createElement("canvas");
          canvas.width = w * scale;
          canvas.height = h * scale;
          const ctx = canvas.getContext("2d");
          ctx.scale(scale, scale);
          ctx.drawImage(imgEl, 0, 0, w, h);

          canvas.toBlob((blob) => {
            if (!blob) { resolve(false); return; }
            const url = URL.createObjectURL(blob);
            triggerDownload(url, generateFilename(imgEl));
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            resolve(true);
          }, "image/png");
        } catch (err) {
          // SecurityError: imagem com taint (cross-origin sem CORS header)
          console.warn("[ESS] canvas nativo falhou (tainted):", err);
          resolve(false);
        }
      };

      if (imgEl.complete && imgEl.naturalWidth > 0) {
        draw();
      } else {
        imgEl.onload = draw;
        imgEl.onerror = () => resolve(false);
      }
    });
  }

  // ─── Estratégia 1: download direto da URL original (para <img>, vídeo, bg) ─
  async function downloadImageDirect(el) {
    let src = null;

    if (el.tagName === "IMG") {
      src = resolveUrl(el.currentSrc || el.src);
    } else if (el.tagName === "VIDEO") {
      src = resolveUrl(el.currentSrc || el.src);
    } else {
      const bg = getComputedStyle(el).backgroundImage;
      const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (match) src = resolveUrl(match[1]);
    }

    if (!src) return false;

    // 1a: fetch (cors ou no-cors)
    const blob = await fetchBlob(src);
    if (blob && blob.size > 0) {
      const mime = blob.type || "image/png";
      const ext = mime.split("/")[1]?.split("+")[0] || "png";
      const filename = generateFilename(el).replace(".png", `.${ext}`);
      const objectUrl = URL.createObjectURL(blob);
      triggerDownload(objectUrl, filename);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      return true;
    }

    // 1b: para <img>, tenta canvas nativo com a imagem já no DOM
    if (el.tagName === "IMG") {
      const ok = await captureImgWithNativeCanvas(el);
      if (ok) return true;
    }

    return false;
  }

  // ─── Estratégia 2: html2canvas com imagens cross-origin tratadas ──────────
  async function captureWithCanvas(el) {
    // Antes de capturar, corrige URLs protocol-relative nas imagens filhas
    // e adiciona crossOrigin para tentar carregar via CORS
    const imgs = el.tagName === "IMG" ? [el] : [...el.querySelectorAll("img")];
    const origAttrs = [];

    for (const img of imgs) {
      const resolved = resolveUrl(img.getAttribute("src") || img.src);
      origAttrs.push({ img, src: img.getAttribute("src"), cross: img.getAttribute("crossorigin") });
      if (resolved) img.setAttribute("src", resolved);
      img.setAttribute("crossorigin", "anonymous");
    }

    el.classList.remove(HIGHLIGHT_CLASS);

    try {
      const canvas = await html2canvas(el, {
        useCORS: true,
        allowTaint: false,       // false = ignora imagens que causam taint em vez de travar
        backgroundColor: "#ffffff",
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false,
        imageTimeout: 8000,
        foreignObjectRendering: false, // mais compatível entre sites
        onclone: (clonedDoc, clonedEl) => {
          // Remove outline do clone para não aparecer no PNG
          clonedEl.style.outline = "none";
          // Corrige imagens no clone
          const clonedImgs = clonedEl.tagName === "IMG"
            ? [clonedEl]
            : [...clonedEl.querySelectorAll("img")];
          for (const img of clonedImgs) {
            const resolved = resolveUrl(img.getAttribute("src") || img.src);
            if (resolved) img.setAttribute("src", resolved);
            img.setAttribute("crossorigin", "anonymous");
          }
        },
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          showToast("Erro ao gerar imagem.", true);
          return;
        }
        const url = URL.createObjectURL(blob);
        triggerDownload(url, generateFilename(el));
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        showToast("Imagem salva!");
      }, "image/png");
    } catch (err) {
      console.error("[ESS] html2canvas falhou:", err);
      showToast("Falha ao capturar elemento.", true);
    } finally {
      el.classList.add(HIGHLIGHT_CLASS);
      // Restaura atributos originais das imagens
      for (const { img, src, cross } of origAttrs) {
        if (src !== null) img.setAttribute("src", src);
        if (cross === null) img.removeAttribute("crossorigin");
        else img.setAttribute("crossorigin", cross);
      }
    }
  }

  // ─── Captura principal: tenta direto, cai no canvas ─────────────────────
  async function captureElement(el) {
    const isImageLike =
      el.tagName === "IMG" ||
      el.tagName === "VIDEO" ||
      /url\(/.test(getComputedStyle(el).backgroundImage);

    showToast("Capturando...");

    if (isImageLike) {
      const ok = await downloadImageDirect(el);
      if (ok) {
        showToast("Imagem salva!");
        return;
      }
      // Para <img> e <video> não cai no html2canvas — não faz sentido renderizar
      // a página inteira só para capturar uma imagem isolada
      if (el.tagName === "IMG" || el.tagName === "VIDEO") {
        showToast("Não foi possível salvar a imagem.", true);
        return;
      }
    }

    // Para SVG direto no DOM
    if (el.tagName === "SVG" || el.closest("svg")) {
      await captureSvg(el.closest("svg") || el);
      return;
    }

    await captureWithCanvas(el);
  }

  // ─── Estratégia 3: exportar SVG inline ───────────────────────────────────
  async function captureSvg(svgEl) {
    try {
      const serializer = new XMLSerializer();
      let svgStr = serializer.serializeToString(svgEl);
      // Garante namespace
      if (!svgStr.includes("xmlns=")) {
        svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      const blob = new Blob([svgStr], { type: "image/svg+xml" });

      // Renderiza no canvas para exportar como PNG
      const img = new Image();
      const url = URL.createObjectURL(blob);
      img.src = url;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        setTimeout(reject, 5000);
      });

      const rect = svgEl.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement("canvas");
      canvas.width = (rect.width || img.naturalWidth) * scale;
      canvas.height = (rect.height || img.naturalHeight) * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, rect.width || img.naturalWidth, rect.height || img.naturalHeight);
      URL.revokeObjectURL(url);

      canvas.toBlob((pngBlob) => {
        const pngUrl = URL.createObjectURL(pngBlob);
        triggerDownload(pngUrl, generateFilename(svgEl));
        setTimeout(() => URL.revokeObjectURL(pngUrl), 5000);
        showToast("SVG salvo como PNG!");
      }, "image/png");
    } catch (err) {
      console.error("[ESS] SVG capture falhou:", err);
      showToast("Falha ao capturar SVG.", true);
    }
  }

  // ─── Event handlers ───────────────────────────────────────────────────────
  // Apenas os elementos de UI da própria extensão devem ser ignorados
  const ESS_SKIP_IDS = new Set(["ess-label", "ess-toast", OVERLAY_ID]);

  function isOwnElement(el) {
    // Sobe a árvore para cobrir filhos dos elementos internos da extensão
    let node = el;
    while (node && node !== document.body) {
      if (ESS_SKIP_IDS.has(node.id)) return true;
      if (node.dataset && node.dataset.essDownload) return true;
      node = node.parentElement;
    }
    return false;
  }

  // Bloqueia qualquer evento que possa causar navegação ou efeito colateral
  function blockEvent(e) {
    if (!isActive || isOwnElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onMouseOver(e) {
    if (!isActive || isOwnElement(e.target)) return;
    if (hoveredElement && hoveredElement !== e.target) {
      hoveredElement.classList.remove(HIGHLIGHT_CLASS);
    }
    hoveredElement = e.target;
    e.target.classList.add(HIGHLIGHT_CLASS);
    updateLabel(e.target);
  }

  function onMouseOut(e) {
    if (!isActive || isOwnElement(e.target)) return;
    e.target.classList.remove(HIGHLIGHT_CLASS);
    hideLabel();
    if (hoveredElement === e.target) hoveredElement = null;
  }

  function onClick(e) {
    if (!isActive || isOwnElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    captureElement(e.target);
  }

  function onKeyDown(e) {
    if (e.key === "Escape" && isActive) deactivate();
  }

  // ─── Ativar / Desativar ───────────────────────────────────────────────────
  function activate() {
    if (isActive) return;
    isActive = true;
    injectStyles();
    document.body.classList.add("ess-active");
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    // mousedown e mouseup bloqueados para impedir drag/follow-link antes do click
    document.addEventListener("mousedown", blockEvent, true);
    document.addEventListener("mouseup", blockEvent, true);
    document.addEventListener("click", onClick, true);
    // Bloqueia também o auxclick (botão do meio) e contextmenu
    document.addEventListener("auxclick", blockEvent, true);
    document.addEventListener("pointerdown", blockEvent, true);
    document.addEventListener("keydown", onKeyDown, true);
    showToast("Modo de seleção ativado");
  }

  function deactivate() {
    if (!isActive) return;
    isActive = false;
    if (hoveredElement) {
      hoveredElement.classList.remove(HIGHLIGHT_CLASS);
      hoveredElement = null;
    }
    document.body.classList.remove("ess-active");
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("mousedown", blockEvent, true);
    document.removeEventListener("mouseup", blockEvent, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("auxclick", blockEvent, true);
    document.removeEventListener("pointerdown", blockEvent, true);
    document.removeEventListener("keydown", onKeyDown, true);
    hideLabel();
    showToast("Modo de seleção desativado");
  }

  // ─── Mensagens do popup ───────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === "TOGGLE") {
      isActive ? deactivate() : activate();
      sendResponse({ active: isActive });
      return true;
    }
    if (message.type === "GET_STATE") {
      sendResponse({ active: isActive });
      return true;
    }
  });
})();
