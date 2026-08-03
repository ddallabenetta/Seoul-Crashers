// Camera 2.5D: segue il bersaglio, guarda avanti in base alla velocità, trema.
// EYE è l'altezza virtuale dell'osservatore: governa la forza della parallasse
// con cui gli edifici si "aprono" verso il bordo dello schermo.
import { clamp, damp } from '../core/math.js';

// Divisore della proiezione: più è basso, più i volumi si "aprono" verso i bordi.
// Lineare in altezza (non prospettico) così le facciate restano parallelogrammi
// e possono essere texturizzate con una trasformazione affine.
export const PROJ = 880;

// Direzione della luce (ombre verso sud-est) e lunghezza delle ombre. Sta qui, e
// non in scene.js, perché la usa anche il hillshade del terreno in ground.js.
export const SUN = { x: 0.5, y: 0.66, scale: 0.42 };

export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.viewW = 1280;
    this.viewH = 720;
    this.dpr = 1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this._t = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
  }

  addShake(amount) {
    this.shake = Math.min(30, this.shake + amount);
  }

  /** target: {x, y, vx, vy}. lead scala l'anticipo sulla velocità. */
  follow(target, dt, lead = 0.34) {
    this._t += dt;
    const tx = target.x + (target.vx || 0) * lead;
    const ty = target.y + (target.vy || 0) * lead;
    this.x = damp(this.x, tx, 0.11, dt);
    this.y = damp(this.y, ty, 0.11, dt);
    this.zoom = damp(this.zoom, this.targetZoom, 0.22, dt);

    if (this.shake > 0.05) {
      this.shake = Math.max(0, this.shake - dt * 34);
      const a = this._t * 47;
      this.shakeX = Math.sin(a) * this.shake * 0.6 + Math.sin(a * 2.3) * this.shake * 0.4;
      this.shakeY = Math.cos(a * 1.7) * this.shake * 0.6 + Math.cos(a * 3.1) * this.shake * 0.4;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shake = 0;
    }
  }

  get cx() { return this.x + this.shakeX; }
  get cy() { return this.y + this.shakeY; }

  /** Applica la trasformazione mondo->schermo al contesto (incluso il DPR). */
  apply(ctx) {
    const z = this.zoom * this.dpr;
    ctx.setTransform(z, 0, 0, z, -this.cx * z + (this.viewW * this.dpr) / 2, -this.cy * z + (this.viewH * this.dpr) / 2);
  }

  /** Trasformazione per la UI: coordinate in pixel CSS. */
  applyUI(ctx) {
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  worldToScreen(wx, wy) {
    const z = this.zoom;
    return {
      x: (wx - this.cx) * z + this.viewW / 2,
      y: (wy - this.cy) * z + this.viewH / 2,
    };
  }

  screenToWorld(sx, sy) {
    const z = this.zoom;
    return {
      x: (sx - this.viewW / 2) / z + this.cx,
      y: (sy - this.viewH / 2) / z + this.cy,
    };
  }

  /** Rettangolo di mondo visibile, con margine in pixel di mondo. */
  bounds(pad = 0) {
    const hw = this.viewW / (2 * this.zoom) + pad;
    const hh = this.viewH / (2 * this.zoom) + pad;
    return { x: this.cx - hw, y: this.cy - hh, w: hw * 2, h: hh * 2 };
  }

  /** Fattore di proiezione per un'altezza z: offset = (p - cam) * factor. */
  projFactor(z) {
    return z / PROJ;
  }

  setZoomTarget(z) {
    this.targetZoom = clamp(z, 0.45, 2.2);
  }
}
