// Matriz de bordes (diseño poblar §7.6, anexo r2 [1], [3], [6], [7], [8], [13]).
// Corre contra `next start` de la integración (BASE, por omisión http://localhost:3130), sin sesión.
// Toda petición a *.supabase.co, /api/mc/progress y /api/session se aborta antes de navegar: no hay login ni sync ni
// eventos. Los worktrees de poblar no tienen .env.local. Las áreas seguras se simulan escribiendo --safe-* en <html>.
//
// Medidas (en Chromium todas; en WebKit 1 a 5 y 7, y la 6 sólo colorScheme, más luminancia si CSS.supports):
//   m1 · los controles «Cerrar», «Salir», «Volver», «×» o «Salir del mundo», tras scrollIntoView({ block: "center" }),
//        quedan con top ≥ --safe-top y bottom ≤ innerHeight − --safe-bottom
//   m2 · button, select, summary, input y a fuera de prosa miden ≥ 44 × 44; radios y casillas se miden por su label
//   m3 · ni el documento ni la raíz del overlay desbordan a lo ancho
//   m4 · ningún control a menos de 16 px del borde seguro
//   m5 · los títulos de más de dos renglones llevan title o aria-label
//   m6 · colorScheme dark y la luminancia de pulgar y pista de scrollbar-color por debajo de 0.5
//   m7 · en el inicio, el header mide ≤ 46 px en los viewports verticales
// Uso: node bordes.cjs  [env: BASE, BROWSERS=chromium,webkit, VIEWPORTS=393x852,..., SUPERFICIES=inicio,forge,...,
//      TAG=nombre, CAPTURAS=1]
const fs = require("fs");
const path = require("path");
const pwPath = require.resolve("playwright", { paths: ["d:/projects/auctorum-systems"] });
const { chromium, webkit } = require(pwPath);

const BASE = process.env.BASE || "http://localhost:3130";
const TAG = process.env.TAG || "matriz";
const OUT = path.join("d:\\projects\\auctorum-systems\\.agents\\tasks\\arcanum-poblar\\e2e", TAG);
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { w: 360, h: 780, top: 24, side: 0, bottom: 0 },
  { w: 375, h: 667, top: 20, side: 0, bottom: 0 },
  { w: 390, h: 844, top: 47, side: 0, bottom: 34 },
  { w: 393, h: 852, top: 59, side: 0, bottom: 34 },
  { w: 430, h: 932, top: 59, side: 0, bottom: 34 },
  { w: 852, h: 393, top: 0, side: 59, bottom: 21 },
].filter((v) => !process.env.VIEWPORTS || process.env.VIEWPORTS.split(",").includes(`${v.w}x${v.h}`));
const BROWSERS = (process.env.BROWSERS || "chromium,webkit").split(",");
const ONLY = process.env.SUPERFICIES ? new Set(process.env.SUPERFICIES.split(",")) : null;
const CAPTURAS = process.env.CAPTURAS !== "0";

// ── medición en la página ─────────────────────────────────────────────────────────────────────────────────────
function medirEnPagina({ safe, browser, inicio }) {
  const out = { m1: [], m2: [], m3: [], m4: [], m5: [], m6: [], m7: [] };
  // La raíz es el overlay que de verdad está arriba: el ancestro fijo (≥ 30 % del alto) del elemento que hay en el
  // centro, arriba o abajo de la ventana. Las capas decorativas `pointer-events-none fixed inset-0` (RankAura,
  // RewardProvider) no cuentan: elementFromPoint las salta. Sin overlay, la raíz es el documento.
  const fixedAncestor = (el) => {
    for (let a = el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.position === "fixed" && cs.pointerEvents !== "none") {
        const r = a.getBoundingClientRect();
        if (r.height >= innerHeight * 0.3 && r.width >= innerWidth * 0.5) return a;
      }
    }
    return null;
  };
  let root = null;
  for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
    const e = document.elementFromPoint(innerWidth * fx, innerHeight * fy);
    const a = e && fixedAncestor(e);
    if (a) { root = a; break; }
  }
  root = root || document.body;
  const vis = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width <= 1 || r.height <= 1 || cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    if (cs.clip && cs.clip.startsWith("rect(0px")) return false;
    return !el.closest("[aria-hidden='true'], [hidden], [inert]");
  };
  const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 48);
  // prosa (§7.6, medida 2): los enlaces dentro de p, li, blockquote o td, y en el lector de libros también los controles
  // de sus listas (índice del libro) y los encabezados del texto (medida 5)
  const enLibro = !!root.querySelector("[aria-label='Cerrar el libro']");
  const inProse = (el) => (el.tagName === "A" && !!el.closest("p, li, blockquote, td, [data-prose]")) || (enLibro && !!el.closest("li, ol, main p"));
  const scrollX = (el) => !!el.closest("pre, table, [data-scroll-x]") || [...ancestors(el)].some((a) => { const o = getComputedStyle(a).overflowX; return (o === "auto" || o === "scroll") && a.scrollWidth > a.clientWidth; });
  function* ancestors(el) { let a = el.parentElement; while (a && a !== document.body) { yield a; a = a.parentElement; } }
  // el lienzo del Mapa (React Flow) es un plano que se arrastra: sus nodos salen de la ventana a propósito y su
  // crédito es de la librería. Cuenta como «lienzo» (§7.6, medida 3); sus controles de zoom sí se miden.
  const lienzo = (el) => !!el.closest(".react-flow__viewport, .react-flow__attribution");
  const controls = [...root.querySelectorAll("button, select, summary, input, a[href], [role=button]")].filter((el) => vis(el) && !lienzo(el));
  // m1
  const cierre = /(^|[\s‹←↩<·])(cerrar|salir|volver)\b|^×$/i;
  for (const el of controls) {
    const n = name(el);
    if (!cierre.test(n) && !/^(cerrar|salir)/i.test(el.getAttribute("aria-label") || "")) continue;
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    if (r.top < safe.top - 0.5 || r.bottom > innerHeight - safe.bottom + 0.5) out.m1.push(`«${n}» top ${Math.round(r.top)} bottom ${Math.round(r.bottom)} (seguro: top ≥ ${safe.top}, bottom ≤ ${innerHeight - safe.bottom})`);
  }
  // m2
  for (const el of controls) {
    if (el.matches("input[type=hidden]") || inProse(el)) continue;
    if (el.matches("input[type=radio], input[type=checkbox]")) {
      const lab = el.closest("label");
      const r = (lab || el).getBoundingClientRect();
      if (r.height < 43.5) out.m2.push(`${lab ? "label" : "input"} «${name(lab || el)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) out.m2.push(`${el.tagName.toLowerCase()} «${name(el)}» ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  // m3
  const se = document.scrollingElement;
  if (se.scrollWidth > innerWidth + 1) out.m3.push(`documento ${se.scrollWidth} > ${innerWidth}`);
  if (root !== document.body && root.scrollWidth > root.clientWidth + 1) out.m3.push(`overlay ${root.scrollWidth} > ${root.clientWidth}`);
  // m4
  for (const el of controls) {
    if (scrollX(el) || inProse(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.left < safe.side + 16 - 0.5 || r.right > innerWidth - safe.side - 16 + 0.5) out.m4.push(`«${name(el)}» left ${Math.round(r.left)} right ${Math.round(innerWidth - r.right)} (mín ${safe.side + 16})`);
  }
  // m5
  for (const h of root.querySelectorAll("h1, h2, h3")) {
    if (enLibro && h.closest("main")) continue;
    if (!vis(h)) continue;
    const lh = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.25 || 20;
    if (h.getBoundingClientRect().height > lh * 2.2 && !h.getAttribute("title") && !h.getAttribute("aria-label")) out.m5.push(`«${name(h)}» ${Math.round(h.getBoundingClientRect().height)} px`);
  }
  // m6
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  if (!/dark/.test(scheme)) out.m6.push(`el documento no declara color-scheme: dark: los controles nativos salen claros (${scheme || "normal"})`);
  const soporta = typeof CSS !== "undefined" && CSS.supports && CSS.supports("scrollbar-color", "red blue");
  if (browser === "chromium" || soporta) {
    const lum = (c) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      if (a === 0) return 0;
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const desplazables = [document.scrollingElement, ...root.querySelectorAll("*")].filter((e) => {
      const cs = getComputedStyle(e);
      return (cs.overflowY === "auto" || cs.overflowY === "scroll" || e === document.scrollingElement) && e.scrollHeight > e.clientHeight + 1;
    });
    for (const e of desplazables.slice(0, 12)) {
      const sc = getComputedStyle(e).scrollbarColor || "";
      const cols = sc.match(/rgba?\([^)]+\)/g) || [];
      for (const c of cols) {
        const L = lum(c);
        if (L !== null && L >= 0.5) out.m6.push(`barra clara (${c}, luminancia ${L.toFixed(2)}) en ${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}`);
      }
    }
  }
  // m7
  if (inicio && innerHeight > innerWidth) {
    const hd = document.querySelector("main header");
    if (hd) { const hh = Math.round(hd.getBoundingClientRect().height); if (hh > 46) out.m7.push(`el encabezado del inicio pasa a dos renglones en línea (${hh} px > 46)`); }
  }
  return { out, root: root === document.body ? "documento" : (root.getAttribute("aria-label") || root.getAttribute("role") || root.className.toString().slice(0, 40)) };
}

// ── navegación ────────────────────────────────────────────────────────────────────────────────────────────────
const btn = (scope, re) => scope.locator("button").filter({ hasText: re }).first();
const wait = (p, ms) => p.waitForTimeout(ms);
async function home(p) {
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await p.getByText("Los mundos · elige territorio").first().waitFor({ timeout: 45000 });
  await wait(p, 700);
}
async function cerrar(p) {
  await p.keyboard.press("Escape");
  await wait(p, 400);
}
async function openCell(p, fam, route, code) {
  await btn(p, new RegExp("^" + fam.replace(/[/]/g, "\\/") + "$")).click({ timeout: 10000 });
  await wait(p, 300);
  await btn(p, new RegExp("^" + route + "$")).click({ timeout: 10000 });
  await wait(p, 300);
  await btn(p, new RegExp("^" + code)).click({ timeout: 10000 });
  await p.locator(`[data-forge-cell-panel="${code}"]`).waitFor({ timeout: 15000 });
  await wait(p, 700);
}
async function forge(p) {
  await home(p);
  await btn(p, /sala de operaciones/i).click({ timeout: 10000 });
  await p.locator("[data-world='forge']").first().waitFor({ timeout: 20000 });
  await wait(p, 1200);
}
const footer = (re) => async (p) => { await home(p); await btn(p, re).click({ timeout: 10000 }); await wait(p, 900); };

const SUPERFICIES = [
  { id: "inicio", inicio: true, open: async (p) => { await home(p); } },
  { id: "inicio-ordenar", inicio: true, open: async (p) => { await home(p); await p.getByRole("button", { name: "Ordenar" }).click(); await wait(p, 300); } },
  { id: "lecturas", open: async (p) => { await footer(/^Lecturas$/)(p); await p.locator("[role=dialog][aria-label='Lecturas'] button").filter({ hasText: /^Leer$/ }).first().waitFor({ timeout: 10000 }).catch(() => {}); await wait(p, 400); } , check: "[role=dialog][aria-label='Lecturas']" },
  { id: "libro", open: async (p) => { await footer(/^Lecturas$/)(p); const lect = p.locator("[role=dialog][aria-label='Lecturas']"); const b = lect.locator("button").filter({ hasText: /^Leer$/ }).first(); await b.click({ timeout: 8000 }); await p.locator("[aria-label='Cerrar el libro']").waitFor({ timeout: 12000 }); await wait(p, 600); } },
  { id: "audio", open: footer(/^Audio$/) , check: "[aria-label='Ajustes de audio']" },
  { id: "notas", open: footer(/^Notas$/) , check: "[aria-label='Cerrar notas']" },
  { id: "mapa", open: footer(/^Mapa$/) , check: "text=MAPA" },
  { id: "agenda", open: footer(/^Agenda$/) , check: "#agenda-title" },
  { id: "codice", open: footer(/^Códice$/) },
  { id: "vigilia", open: footer(/^Vigilia$/) },
  { id: "offline", open: async (p) => { await home(p); await p.locator("[aria-label='Estado offline']").first().click(); await wait(p, 700); } , check: "[aria-label='Offline']" },
  { id: "auth", open: async (p) => { await home(p); await p.locator("main header button").last().click(); await wait(p, 700); } },
  { id: "itc-mapa", open: async (p) => { await home(p); await btn(p, /La sala del trono/).click({ timeout: 10000 }); await wait(p, 1500); } },
  { id: "itc-celda", open: async (p) => { await home(p); await btn(p, /La sala del trono/).click({ timeout: 10000 }); await wait(p, 1500); await btn(p, /CS50/).click({ timeout: 10000 }); await wait(p, 1200); } , check: "#topic-title" },
  { id: "itc-leccion", open: async (p) => { await home(p); await btn(p, /La sala del trono/).click({ timeout: 10000 }); await wait(p, 1500); await btn(p, /CS50/).click({ timeout: 10000 }); await wait(p, 1000); await btn(p, /Lección corta/).click({ timeout: 8000 }); await wait(p, 400); await btn(p, /Entrar a la lección|Otra lección/).click({ timeout: 8000 }); await wait(p, 4500); }, check: "[aria-label^='Lección · ']" },
  { id: "itc-ejercicios", open: async (p) => { await home(p); await btn(p, /La sala del trono/).click({ timeout: 10000 }); await wait(p, 1500); await btn(p, /CS50/).click({ timeout: 10000 }); await wait(p, 1000); await btn(p, /Entrar a los ejercicios/).click({ timeout: 8000 }); await wait(p, 1500); }, check: "[aria-label^='Ejercicios · ']" },
  { id: "forge", open: forge , check: "[data-world='forge']" },
  { id: "atlas", open: async (p) => { await forge(p); await btn(p, /^ATLAS · /).click({ timeout: 10000 }); await p.locator("[data-forge-atlas]").waitFor({ timeout: 15000 }); await wait(p, 1200); } , check: "[data-forge-atlas]" },
  { id: "f0-01-mision", open: async (p) => { await forge(p); await openCell(p, "Fundamentos", "F0", "F0-01"); await btn(p.locator('[data-forge-cell-panel="F0-01"]'), /Abrir la misión/).click({ timeout: 10000 }); await p.locator('section[data-forge-flow="mision"]').waitFor({ timeout: 15000 }); await wait(p, 800); } , check: "section[data-forge-flow='mision']" },
  { id: "f0-04-expediente", open: async (p) => { await forge(p); await openCell(p, "Fundamentos", "F0", "F0-04"); } , check: "[data-forge-cell-panel='F0-04']" },
  { id: "s1-01-sql", open: async (p) => { await forge(p); await openCell(p, "Sistemas y diseño", "S1", "S1-01"); const ev = p.locator('[data-forge-evaluations="S1-01"]'); await ev.scrollIntoViewIfNeeded(); await ev.locator('[data-forge-eval="sql"]').first().click({ timeout: 15000 }); await wait(p, 1500); } , check: "[data-forge-runner='sql']" },
  { id: "p2-01-ontologia", open: async (p) => { await forge(p); await openCell(p, "Plataforma Foundry/AIP", "P2", "P2-01"); const ev = p.locator('[data-forge-evaluations="P2-01"]'); await ev.scrollIntoViewIfNeeded(); await ev.locator('[data-forge-eval="ontologia"]').first().click({ timeout: 15000 }); await wait(p, 1500); } , check: "[data-forge-runner='ontologia']" },
].filter((s) => !ONLY || ONLY.has(s.id));

async function ctxFor(b, browser, v) {
  const mobile = browser === "chromium";
  const ctx = await b.newContext({ viewport: { width: v.w, height: v.h }, isMobile: mobile && v.w < 900, hasTouch: mobile, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, (r) => r.abort());
  await ctx.route(/\/api\/(mc\/progress|session)/, (r) => r.abort());
  const safe = { top: v.top, side: v.side, bottom: v.bottom };
  await ctx.addInitScript((s) => {
    try {
      localStorage.setItem("arcanum_authed", "1");
      // cada superficie arranca del inicio: sin esto, RESUME reabre la última superficie al recargar y tapa el pie
      localStorage.removeItem("arcanum_resume");
    } catch {}
    const apply = () => {
      const st = document.documentElement && document.documentElement.style;
      if (!st) return;
      st.setProperty("--safe-top", s.top + "px");
      st.setProperty("--safe-bottom", s.bottom + "px");
      st.setProperty("--safe-left", s.side + "px");
      st.setProperty("--safe-right", s.side + "px");
    };
    apply();
    document.addEventListener("DOMContentLoaded", apply);
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  }, safe);
  return { ctx, safe };
}

(async () => {
  const filas = [];
  let violaciones = 0;
  for (const browser of BROWSERS) {
    const engine = browser === "webkit" ? webkit : chromium;
    let b;
    try { b = await engine.launch(); } catch (e) { filas.push({ browser, error: "no se pudo lanzar: " + String(e.message).split("\n")[0] }); continue; }
    for (const v of VIEWPORTS) {
      const { ctx, safe } = await ctxFor(b, browser, v);
      const p = await ctx.newPage();
      for (const s of SUPERFICIES) {
        const fila = { browser, viewport: `${v.w}x${v.h}`, superficie: s.id };
        try {
          await s.open(p);
          if (s.check && !(await p.locator(s.check).first().isVisible().catch(() => false))) throw new Error(`no se abrió: falta ${s.check}`);
          const { out, root } = await p.evaluate(medirEnPagina, { safe, browser, inicio: !!s.inicio });
          if (browser === "webkit") out.m6 = out.m6.filter((x) => x.startsWith("el documento") || x.startsWith("barra clara"));
          fila.raiz = root;
          fila.medidas = out;
          const n = Object.values(out).reduce((a, l) => a + l.length, 0);
          fila.violaciones = n;
          violaciones += n;
          if (CAPTURAS && (s.id === "inicio" || s.id === "forge" || s.id === "lecturas") && (v.w === 360 || v.w === 393 || v.w === 852)) await p.screenshot({ path: path.join(OUT, `${browser}-${s.id}-${v.w}x${v.h}.png`) });
        } catch (e) {
          fila.abierta = false;
          fila.error = String(e.message).split("\n")[0].slice(0, 200);
        }
        filas.push(fila);
        for (const [k, l] of Object.entries(fila.medidas || {})) for (const x of l) console.log(`[${browser} ${fila.viewport}] ${s.id}: ${k} ${x}`);
        if (fila.error) console.log(`[${browser} ${fila.viewport}] ${s.id}: NO ABIERTA · ${fila.error}`);
        await cerrar(p).catch(() => {});
      }
      await ctx.close();
    }
    await b.close();
  }
  fs.writeFileSync(path.join(OUT, "resultado.json"), JSON.stringify(filas, null, 1));
  const noAbiertas = filas.filter((f) => f.abierta === false).length;
  console.log(`RESUMEN ${TAG}: filas=${filas.length} violaciones=${violaciones} no_abiertas=${noAbiertas}`);
  process.exit(violaciones > 0 || noAbiertas > 0 ? 1 : 0);
})();
