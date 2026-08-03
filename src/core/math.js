// Utility matematiche condivise. Unità di mondo: pixel. 1 metro = PX_PER_M pixel.
export const TAU = Math.PI * 2;
export const PX_PER_M = 12;
// px/s -> km/h
export const KMH = (pxPerSec) => (pxPerSec / PX_PER_M) * 3.6;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

/** Normalizza un angolo in [-PI, PI]. */
export function wrapAngle(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/** Differenza angolare più breve da a verso b. */
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

/** Ruota a verso b di al massimo maxStep radianti. */
export function approachAngle(a, b, maxStep) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return wrapAngle(a + sign(d) * maxStep);
}

/** Avvicina v a target di al massimo step. */
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return target;
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/**
 * Collisione cerchio/rettangolo con vettore di uscita.
 * Restituisce {nx, ny, depth} dove (nx,ny) è la normale verso l'esterno, oppure null.
 */
export function circleRectPush(cx, cy, r, rect) {
  const rx = rect.x, ry = rect.y, rw = rect.w, rh = rect.h;
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  let dx = cx - closestX;
  let dy = cy - closestY;
  const d2 = dx * dx + dy * dy;

  if (d2 > r * r) return null;

  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    return { nx: dx / d, ny: dy / d, depth: r - d };
  }

  // Centro dentro il rettangolo: esci dal lato più vicino.
  const left = cx - rx;
  const right = rx + rw - cx;
  const top = cy - ry;
  const bottom = ry + rh - cy;
  const min = Math.min(left, right, top, bottom);
  if (min === left) return { nx: -1, ny: 0, depth: left + r };
  if (min === right) return { nx: 1, ny: 0, depth: right + r };
  if (min === top) return { nx: 0, ny: -1, depth: top + r };
  return { nx: 0, ny: 1, depth: bottom + r };
}

/** Distanza dal punto p al segmento ab, con parametro t di proiezione. */
export function pointSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const l2 = abx * abx + aby * aby;
  let t = l2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / l2;
  t = clamp(t, 0, 1);
  const qx = ax + abx * t, qy = ay + aby * t;
  return { t, x: qx, y: qy, dist: dist(px, py, qx, qy) };
}

/** Ruota un punto locale (lx,ly) di ang e lo trasla in (x,y). */
export function rotatePoint(lx, ly, ang, x = 0, y = 0) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return { x: x + lx * c - ly * s, y: y + lx * s + ly * c };
}

/** Interpolazione esponenziale indipendente dal framerate. */
export function damp(current, target, halfLife, dt) {
  if (halfLife <= 0) return target;
  const k = Math.pow(0.5, dt / halfLife);
  return target + (current - target) * k;
}
