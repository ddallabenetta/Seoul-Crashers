// Metriche condivise del layout canvas. La UI è disegnata in pixel CSS logici
// (la vista della camera): ogni pannello ricava da qui il rettangolo sicuro,
// invece di indovinarlo partendo da una larghezza desktop. MobileControls resta
// opzionale perché sui dispositivi senza touch non deve cambiare nulla.

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function uiLayout(w, h, game = null) {
  const controls = !!game?.mobileControls?.active;
  const narrow = w < 700;
  const short = h < 500;
  const compact = controls || narrow || short;
  const portrait = h >= w;
  // Sopra il breakpoint largo resta esattamente il ritmo desktop da 22/64 px.
  const safeX = compact ? clamp(Math.round(w * 0.045), 10, 28) : 22;
  const safeTop = compact ? clamp(Math.round(h * 0.035), 10, 24) : 22;
  // I controlli touch occupano gli angoli inferiori: questa fascia libera evita
  // che suggerimenti, barra armi e piedi dei pannelli finiscano sotto le dita.
  const controlBottom = controls ? clamp(Math.round(h * (portrait ? 0.26 : 0.34)), 68, 142) : 0;
  const safeBottom = compact
    ? Math.max(12, controlBottom + (short ? 8 : 16))
    : 22;
  const scale = compact ? clamp(Math.min(w / 700, h / 500), 0.66, 1) : 1;
  return {
    w, h, narrow, short, compact, portrait, controls,
    safeX, safeTop, safeBottom, controlBottom,
    scale,
    usableW: Math.max(1, w - safeX * 2),
    usableH: Math.max(1, h - safeTop - safeBottom),
    // Un pannello può usare quasi tutto lo schermo, conservando un margine
    // toccabile. Gli stessi valori alimentano anche gli hit-test del puntatore.
    modalX: safeX,
    modalY: safeTop,
    modalW: Math.max(1, w - safeX * 2),
    modalH: Math.max(1, h - safeTop - safeBottom),
  };
}

export function insideRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function fitRect(w, h, maxW, maxH, aspect = 1) {
  let rw = Math.min(maxW, maxH * aspect);
  let rh = rw / aspect;
  if (rh > maxH) { rh = maxH; rw = rh * aspect; }
  return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
}

export function ellipsisText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let s = String(text);
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}
