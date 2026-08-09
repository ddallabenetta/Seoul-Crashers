import { VEHICLE_TYPES } from '../render/sprites.js';

// I controlli touch emettono gli stessi fronti della tastiera, ma raccontano il
// mondo con icone contestuali: il giocatore vede l'azione, non il tasto desktop
// che la implementa. Missioni, negozi, metro e veicoli restano le fonti di verità.

const STYLE = `
#mobile-controls {
  position: fixed; inset: 0; z-index: 7; pointer-events: none;
  padding: max(8px, env(safe-area-inset-top))
    max(8px, env(safe-area-inset-right))
    max(8px, env(safe-area-inset-bottom))
    max(8px, env(safe-area-inset-left));
  font: 600 12px/1 system-ui, sans-serif;
  color: #f4f7fb; touch-action: none; user-select: none;
  -webkit-user-select: none; -webkit-touch-callout: none;
}
#mobile-controls[hidden] { display: none; }
#mobile-controls .mc-play,
#mobile-controls .mc-nav,
#mobile-controls .mc-cutscene { position: absolute; inset: 0; }
#mobile-controls .mc-play[hidden],
#mobile-controls .mc-nav[hidden],
#mobile-controls .mc-cutscene[hidden] { display: none; }
#mobile-controls button {
  appearance: none; border: 1px solid rgba(226,236,248,.34);
  color: #f4f7fb; background: rgba(10,14,21,.72);
  min-width: 44px; min-height: 44px; padding: 7px 10px;
  border-radius: 12px; font: 700 12px/1.1 system-ui, sans-serif;
  letter-spacing: .02em; text-align: center; touch-action: none;
  user-select: none; -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent; pointer-events: auto;
}
#mobile-controls button:focus-visible { outline: 2px solid #64d5ff; outline-offset: 2px; }
#mobile-controls button.mc-held.active,
#mobile-controls button:active { background: rgba(255,95,162,.78); border-color: #ff9bc2; }
#mobile-controls .mc-stick {
  position: absolute; bottom: max(16px, env(safe-area-inset-bottom));
  width: 112px; height: 112px; min-width: 112px; min-height: 112px;
  border-radius: 50%; padding: 0; background: rgba(8,12,18,.48);
  border-color: rgba(226,236,248,.3);
}
#mobile-controls .mc-stick.left { left: max(14px, env(safe-area-inset-left)); }
#mobile-controls .mc-stick.right { right: max(14px, env(safe-area-inset-right)); }
#mobile-controls .mc-stick::before {
  content: ''; position: absolute; inset: 25%; border: 1px solid rgba(226,236,248,.22);
  border-radius: 50%; pointer-events: none;
}
#mobile-controls .mc-stick-knob {
  position: absolute; left: 50%; top: 50%; width: 36px; height: 36px;
  margin: -18px 0 0 -18px; border-radius: 50%;
  background: rgba(100,213,255,.72); border: 2px solid rgba(255,255,255,.72);
  pointer-events: none; transform: translate3d(0,0,0);
}
#mobile-controls .mc-stick.right .mc-stick-knob { background: rgba(255,95,162,.72); }
#mobile-controls .mc-stick-caption {
  position: absolute; left: 0; right: 0; bottom: -17px; opacity: .65;
  font: 700 10px/1 system-ui, sans-serif; pointer-events: none;
}
#mobile-controls .mc-actions {
  position: absolute; right: max(14px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  width: min(250px, 43vw); display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  transform: translateY(-118px);
}
#mobile-controls .mc-actions button { min-height: 44px; padding-inline: 5px; }
#mobile-controls .mc-icon {
  display: block; width: 25px; height: 25px; margin: auto;
  fill: none; stroke: currentColor; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round; pointer-events: none;
}
#mobile-controls .mc-context {
  opacity: .3; color: rgba(244,247,251,.7);
  transition: opacity .14s ease, color .14s ease, background .14s ease,
    border-color .14s ease, box-shadow .14s ease;
}
#mobile-controls .mc-context.available {
  opacity: 1; color: #eafaff; background: rgba(24,122,153,.72);
  border-color: rgba(105,224,255,.86);
  box-shadow: 0 0 0 1px rgba(105,224,255,.18), 0 0 15px rgba(56,214,255,.48);
}
#mobile-controls .mc-context[aria-disabled="true"] { cursor: default; }
#mobile-controls button.selected {
  color: #8ceaff; border-color: rgba(100,213,255,.72);
  background: rgba(24,105,134,.72); box-shadow: 0 0 12px rgba(56,214,255,.3);
}
#mobile-controls .mc-actions button[data-action="pause"],
#mobile-controls .mc-actions button[data-action="map"] { background: rgba(8,12,18,.54); }
#mobile-controls .mc-nav {
  display: flex; align-items: flex-end; justify-content: center; background: transparent;
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}
#mobile-controls .mc-nav-pad {
  display: grid; grid-template-columns: repeat(6, 44px); grid-template-rows: 44px;
  gap: 6px; width: auto; padding: 8px; border-radius: 16px;
  background: rgba(8,12,18,.64); border: 1px solid rgba(226,236,248,.2);
}
#mobile-controls .mc-nav-pad button { min-width: 44px; min-height: 44px; padding: 4px; }
#mobile-controls .mc-cutscene { display: flex; align-items: flex-end; justify-content: flex-end; }
#mobile-controls .mc-cutscene button { margin: 0 8px 18px 0; min-width: 96px; }
#mobile-controls .mc-hint {
  position: absolute; left: 50%; bottom: max(13px, env(safe-area-inset-bottom));
  transform: translateX(-50%); opacity: .56; pointer-events: none; white-space: nowrap;
}
@media (orientation: portrait) {
  #mobile-controls .mc-actions { width: min(202px, 63vw); transform: translateY(-118px); }
  #mobile-controls .mc-stick { width: 104px; height: 104px; min-width: 104px; min-height: 104px; }
}
@media (orientation: landscape) {
  #mobile-controls .mc-actions {
    width: min(250px, 45vw); grid-template-columns: repeat(5, 1fr);
    transform: translateY(-104px);
  }
  #mobile-controls .mc-stick { width: 104px; height: 104px; min-width: 104px; min-height: 104px; }
}
@media (min-width: 900px) and (orientation: landscape) {
  #mobile-controls .mc-actions { width: 270px; }
}
`;

const svg = (body) => `<svg class="mc-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

// Pittogrammi a tratto: restano nitidi a ogni DPR e prendono il colore dello
// stato del bottone. Nessuna icona contiene lettere o dipende da un font emoji.
const ICONS = {
  interact: svg('<path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M11.5 9V4.5a1.5 1.5 0 0 1 3 0V10"/><path d="M14.5 9V6a1.5 1.5 0 0 1 3 0v5"/><path d="M17.5 10a1.5 1.5 0 0 1 3 0v3.5c0 4.1-2.7 7-6.7 7h-1.1c-2.2 0-3.5-.8-4.8-2.4L4.2 13.5a1.6 1.6 0 0 1 2.4-2.1l1.9 1.9"/>'),
  carIn: svg('<path d="M3 14.5v-3l2-4h10l2 4v5H3z"/><path d="M5 7.5 6.5 5h7L15 7.5M5.5 14.5h.01M14.5 14.5h.01M5 16.5V19M15 16.5V19"/><path d="M18 9h4m-2-2 2 2-2 2"/>'),
  carOut: svg('<path d="M7 14.5v-3l2-4h10l2 4v5H7z"/><path d="M9 7.5 10.5 5h7L19 7.5M9.5 14.5h.01M18.5 14.5h.01M9 16.5V19M19 16.5V19"/><path d="M6 9H2m2-2L2 9l2 2"/>'),
  door: svg('<path d="M5 21h14M7 21V3h10v18M14 12h.01"/><path d="M2 12h4m-2-2 2 2-2 2"/>'),
  shop: svg('<path d="M4 10v10h16V10M3 8l2-4h14l2 4"/><path d="M3 8a2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 4 0 2 2 0 0 0 2 0M9 20v-6h6v6"/>'),
  stairs: svg('<path d="M3 19h5v-4h4v-4h4V7h5"/><path d="m15 4 3-3 3 3M18 1v6"/>'),
  bed: svg('<path d="M3 5v15M21 10v10M3 17h18M6 10h13a2 2 0 0 1 2 2v5H3v-4a3 3 0 0 1 3-3zM6 10V7h5a2 2 0 0 1 2 2v1"/>'),
  train: svg('<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M8 7h8M8 12h.01M16 12h.01M8 19l-2 3M16 19l2 3M8 16h8"/>'),
  mission: svg('<path d="M5 22V3M5 4h11l-2 3 2 3H5"/><circle cx="5" cy="3" r="1"/>'),
  cash: svg('<path d="M4 7h16v10H4z"/><path d="M7 10h.01M17 14h.01"/><circle cx="12" cy="12" r="2.5"/><path d="M7 4h13v10M4 10H2v10h15v-3"/>'),
  alternate: svg('<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>'),
  horn: svg('<path d="M4 10h5l7-4v12l-7-4H4zM4 10v4M19 9l2-2M19 15l2 2M19 12h3"/>'),
  sprint: svg('<circle cx="15" cy="4" r="2"/><path d="m13 7-3 4 4 2 2 4M13 7l4 3 3 1M10 11l-3 4-4 1M14 13l-4 7"/>'),
  brake: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M5.5 6.5 3 4M18.5 6.5 21 4M5.5 17.5 3 20M18.5 17.5 21 20"/>'),
  climbUp: svg('<path d="m6 15 6-6 6 6M6 20l6-6 6 6"/>'),
  climbDown: svg('<path d="m6 4 6 6 6-6M6 9l6 6 6-6"/>'),
  scope: svg('<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1"/>'),
  weapon: svg('<path d="M5 11h9l3 3v3h-4l-2-3H8l-1 5H4l1-8zM7 8l8-3 2 2-6 4"/><path d="M3 6a9 9 0 0 1 16-2M18 1l1 3-3 1M21 18a9 9 0 0 1-16 2M6 23l-1-3 3-1"/>'),
  map: svg('<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  radio: svg('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m6 7 10-4M7 11h6M7 15h4"/><circle cx="17" cy="14" r="2.5"/>'),
};

const ACTIONS = [
  ['interact', 'interact', 'Interagisci'],
  ['alternate', 'alternate', 'Azione alternativa'],
  ['sprint', 'sprint', 'Scatto'],
  ['brake', 'brake', 'Freno a mano'],
  ['scope', 'scope', 'Mira di precisione'],
  ['weapon', 'weapon', 'Cambia arma'],
  ['map', 'map', 'Mappa'],
  ['pause', 'pause', 'Pausa'],
  ['radio', 'radio', 'Radio (tieni premuto per spegnere)'],
];

const NAV = [
  ['nav-up', '▲', 'Naviga su', 'ArrowUp'],
  ['nav-left', '◀', 'Naviga a sinistra', 'ArrowLeft'],
  ['nav-confirm', '✓', 'Conferma', 'Enter'],
  ['nav-right', '▶', 'Naviga a destra', 'ArrowRight'],
  ['nav-down', '▼', 'Naviga giù', 'ArrowDown'],
  ['nav-back', '↩', 'Indietro', 'Escape'],
];

function touchCapable() {
  if (typeof window === 'undefined') return false;
  const forced = new URLSearchParams(window.location?.search || '').has('touch');
  const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
  const points = Number(window.navigator?.maxTouchPoints || 0) > 0;
  return forced || !!coarse || points || 'ontouchstart' in window;
}

export class MobileControls {
  constructor(game) {
    this.game = game;
    this.input = game.input;
    this.force = typeof window !== 'undefined'
      && new URLSearchParams(window.location?.search || '').has('touch');
    this.capable = touchCapable();
    this.active = this.capable;
    this.mode = '';
    this._held = new Map();
    this._sticks = new Map();
    this._radioState = null;
    this.root = null;
    this.buttons = new Map();
    if (typeof document === 'undefined' || !document.body) return;
    this._installStyle();
    this._build();
    window.addEventListener('blur', () => this.clear());
    window.addEventListener('pagehide', () => this.clear());
  }

  _installStyle() {
    if (document.getElementById('mobile-controls-style')) return;
    const style = document.createElement('style');
    style.id = 'mobile-controls-style';
    style.textContent = STYLE;
    document.head?.appendChild(style);
  }

  _button(parent, id, label, aria = label, className = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.action = id;
    b.className = className;
    b.textContent = label;
    b.setAttribute('aria-label', aria);
    b.title = aria;
    parent.appendChild(b);
    this.buttons.set(id, b);
    return b;
  }

  _build() {
    this.root = document.createElement('div');
    this.root.id = 'mobile-controls';
    this.root.setAttribute('aria-label', 'Controlli touch');
    this.root.hidden = !this.active;

    const play = document.createElement('div');
    play.className = 'mc-play';
    const left = this._button(play, 'stick-left', '', 'Muovi / sterza', 'mc-stick left');
    left.innerHTML = '<span class="mc-stick-knob"></span><span class="mc-stick-caption">MUOVI</span>';
    const right = this._button(play, 'stick-right', '', 'Mira e spara', 'mc-stick right');
    right.innerHTML = '<span class="mc-stick-knob"></span><span class="mc-stick-caption">MIRA / FUOCO</span>';
    const actions = document.createElement('div');
    actions.className = 'mc-actions';
    play.appendChild(actions);
    for (const [id, icon, aria] of ACTIONS) {
      const contextual = id === 'interact' || id === 'alternate' ? ' mc-context' : '';
      const button = this._button(actions, id, '', aria, `mc-held${contextual}`);
      this._setIcon(button, icon);
      this._bindAction(button, id);
    }
    this._bindStick(left, 'left');
    this._bindStick(right, 'right');

    const nav = document.createElement('div');
    nav.className = 'mc-nav';
    const pad = document.createElement('div');
    pad.className = 'mc-nav-pad';
    nav.appendChild(pad);
    for (const [id, label, aria, key] of NAV) {
      const button = this._button(pad, id, label, aria);
      this._bindKey(button, key, `mc:${id}`);
    }

    const cutscene = document.createElement('div');
    cutscene.className = 'mc-cutscene';
    const skip = this._button(cutscene, 'skip', 'Salta', 'Salta la cutscene', 'mc-held');
    this._bindKey(skip, 'Escape', 'mc:skip');
    const hint = document.createElement('span');
    hint.className = 'mc-hint';
    hint.textContent = 'Tocca la scena per continuare';
    cutscene.appendChild(hint);

    this.root.append(play, nav, cutscene);
    document.body.appendChild(this.root);
    this._layers = { play, nav, cutscene };
  }

  _bindKey(button, code, source) {
    const begin = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (button.dataset.available === 'false') return;
      try { button.setPointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
      if (this._held.get(source)) return;
      const actualCode = typeof code === 'function' ? code() : code;
      this._held.set(source, actualCode);
      this.input.press(actualCode, source);
      button.classList.add('active');
    };
    const end = (e) => {
      e.preventDefault(); e.stopPropagation();
      const actualCode = this._held.get(source);
      if (!actualCode) return;
      this._held.delete(source);
      this.input.release(actualCode, source);
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', begin);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    // L'attivazione da tastiera mantiene il <button> accessibile senza duplicare
    // il gesto del puntatore (`detail` è diverso da zero in quel caso).
    button.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      if (button.dataset.available === 'false') return;
      const actualCode = typeof code === 'function' ? code() : code;
      this.input.press(actualCode, source);
      this.input.release(actualCode, source);
    });
  }

  _bindAction(button, id) {
    if (id === 'weapon') {
      const action = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (button.dataset.available === 'false') return;
        this.input.virtualWheel(1);
      };
      button.addEventListener('pointerdown', action);
      button.addEventListener('click', (e) => { if (e.detail === 0) action(e); });
      return;
    }
    if (id === 'radio') {
      this._bindRadio(button);
      return;
    }
    const map = {
      interact: 'KeyE', sprint: 'ShiftLeft', brake: 'Space',
      scope: 'MouseRight', map: 'KeyM', pause: 'Escape',
    };
    const code = id === 'alternate'
      ? () => (this._inVehicle() ? 'KeyH' : 'KeyF')
      : map[id];
    if (code === 'MouseRight') this._bindMouse(button, 2, `mc:${id}`);
    else this._bindKey(button, code, `mc:${id}`);
  }

  _inVehicle() {
    const player = this.game.player;
    return !!(player && !player.onFoot && player.vehicle);
  }

  _bindRadio(button) {
    const source = 'mc:radio';
    const state = { held: false, off: false, timer: null };
    const end = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!state.held) return;
      state.held = false;
      if (state.timer != null) clearTimeout(state.timer);
      state.timer = null;
      if (state.off) {
        this.input.release('KeyR', source);
        this.input.release('ShiftLeft', source);
      } else {
        this.input.press('KeyR', source);
        this.input.release('KeyR', source);
      }
      state.off = false;
      this._held.delete(source);
      button.classList.remove('active');
    };
    const begin = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (button.dataset.available === 'false') return;
      try { button.setPointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
      if (state.held) return;
      state.held = true;
      state.off = false;
      this._held.set(source, 'KeyR');
      // Il tocco breve passa stazione al rilascio; tenere premuto per un istante
      // emette Shift+R e spegne la radio senza cambiarla prima per errore.
      state.timer = setTimeout(() => {
        if (!state.held) return;
        state.off = true;
        this.input.press('ShiftLeft', source);
        this.input.press('KeyR', source);
      }, 650);
      button.classList.add('active');
    };
    button.addEventListener('pointerdown', begin);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    button.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      if (button.dataset.available === 'false') return;
      this.input.press('KeyR', source);
      this.input.release('KeyR', source);
    });
    this._radioState = state;
  }

  _bindMouse(button, buttonCode, source) {
    const begin = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (button.dataset.available === 'false') return;
      try { button.setPointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
      if (this._held.get(source)) return;
      this._held.set(source, true);
      this.input.setRight(true, source);
      button.classList.add('active');
    };
    const end = (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this._held.get(source)) return;
      this._held.delete(source);
      this.input.setRight(false, source);
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', begin);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
    button.addEventListener('click', (e) => {
      if (e.detail === 0 && button.dataset.available !== 'false') {
        this.input.setRight(true, source); this.input.setRight(false, source);
      }
    });
    void buttonCode;
  }

  _bindStick(button, side) {
    const knob = button.querySelector('.mc-stick-knob');
    const state = { pointer: null, x: 0, y: 0 };
    this._sticks.set(side, state);
    const move = (e) => {
      if (state.pointer !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      const r = button.getBoundingClientRect();
      const radius = Math.max(1, Math.min(r.width, r.height) * 0.42);
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      const length = Math.hypot(x, y) || 1;
      const scale = Math.min(1, radius / length);
      state.x = (x * scale) / radius;
      state.y = (y * scale) / radius;
      knob.style.transform = `translate3d(${state.x * radius}px,${state.y * radius}px,0)`;
      if (side === 'left') this.input.setMove(state.x, state.y);
      else this._aimStick(state.x, state.y);
    };
    const end = (e) => {
      if (state.pointer !== e.pointerId) return;
      e.preventDefault(); e.stopPropagation();
      state.pointer = null; state.x = 0; state.y = 0;
      knob.style.transform = 'translate3d(0,0,0)';
      if (side === 'left') this.input.setMove(0, 0);
      else this.input.setFire(false, 'mc:aim-fire');
      button.classList.remove('active');
    };
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (state.pointer != null) return;
      state.pointer = e.pointerId;
      try { button.setPointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
      if (side === 'right') this.input.setFire(true, 'mc:aim-fire');
      button.classList.add('active');
      move(e);
    });
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', end);
    button.addEventListener('pointercancel', end);
    button.addEventListener('lostpointercapture', end);
  }

  _aimStick(x, y) {
    const canvas = this.game.canvas;
    const w = canvas.clientWidth || this.game.camera?.viewW || window.innerWidth;
    const h = canvas.clientHeight || this.game.camera?.viewH || window.innerHeight;
    const reach = Math.max(80, Math.min(w, h) * 0.55);
    this.input.setAim(w * 0.5 + x * reach, h * 0.5 + y * reach);
  }

  _mode() {
    if (this.game.cutscene?.active) return 'cutscene';
    if (this.game.dialogue?.active) return 'dialogue';
    if (!this.game.started) return 'title';
    if (this.game.mode?.id === 'menu') return 'menu';
    return 'play';
  }

  _releaseHeld() {
    if (this._radioState?.timer != null) clearTimeout(this._radioState.timer);
    if (this._radioState) {
      this._radioState.timer = null;
      this._radioState.held = false;
      this._radioState.off = false;
    }
    this.input.clearVirtual?.();
    this._held.clear();
    for (const [side, state] of this._sticks) {
      state.pointer = null; state.x = 0; state.y = 0;
      const knob = this.buttons.get(`stick-${side}`)?.querySelector('.mc-stick-knob');
      if (knob) knob.style.transform = 'translate3d(0,0,0)';
    }
    this.buttons.forEach((b) => b.classList.remove('active'));
  }

  _show(layer, show) { if (layer) layer.hidden = !show; }

  _setIcon(button, name) {
    if (!button || button.dataset.icon === name) return;
    button.innerHTML = ICONS[name] || ICONS.interact;
    button.dataset.icon = name;
  }

  _setButton(id, { icon, label, visible = true, available = true, selected = false }) {
    const button = this.buttons.get(id);
    if (!button) return;
    button.hidden = !visible;
    button.dataset.available = available ? 'true' : 'false';
    button.setAttribute('aria-disabled', available ? 'false' : 'true');
    button.classList.toggle('available', available);
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-label', label);
    button.title = label;
    this._setIcon(button, icon);
  }

  _actionFor(key) {
    const matches = (a) => String(a?.key || 'E').toUpperCase() === key;
    const mission = this.game.missions?.actions?.find(matches);
    if (mission) return { action: mission, source: 'mission' };
    const shop = this.game.shops?.actions?.find(matches);
    if (shop) return { action: shop, source: 'shop' };
    return null;
  }

  _iconForAction(text, source, fallback = 'interact') {
    if (source === 'mission') return 'mission';
    const s = String(text || '').toLocaleLowerCase('it');
    if (/metro|treno|banchina|tornell/.test(s)) return 'train';
    if (/sali al|scendi al|piano|scala/.test(s)) return 'stairs';
    if (/dormi|letto/.test(s)) return 'bed';
    if (/vendi|cassa|contanti|paga/.test(s)) return 'cash';
    if (/listino|negozio|entra in|compra/.test(s)) return 'shop';
    if (/esci|porta|retro/.test(s)) return 'door';
    return fallback;
  }

  _interactionState(player, vehicle) {
    const ready = !!player && !player.dying && player.enterCooldown <= 0;
    if (vehicle) {
      const airborne = !!VEHICLE_TYPES[player.vehicle.kind]?.air && player.vehicle.z > 6;
      return {
        icon: 'carOut', available: ready && !airborne,
        label: airborne ? 'Atterra prima di scendere' : 'Scendi dal mezzo',
      };
    }

    const contextual = this._actionFor('E');
    if (contextual) {
      return {
        icon: this._iconForAction(contextual.action.text, contextual.source),
        available: ready,
        label: contextual.action.text || 'Interagisci',
      };
    }

    const metroHint = this.game.metro?.hint?.(this.game);
    if (/^\s*E\s*[—-]/i.test(metroHint || '')) {
      return {
        icon: 'train', available: ready,
        label: String(metroHint).replace(/^\s*E\s*[—-]\s*/i, ''),
      };
    }

    const nearby = !this.game.indoors && !this.game.metro?.inside
      && !this.game.shops?.near && player?.onFoot
      ? player.findNearbyVehicle?.(this.game)
      : null;
    if (nearby) return { icon: 'carIn', available: ready, label: 'Sali sul mezzo' };
    return { icon: 'interact', available: false, label: 'Nessuna interazione disponibile' };
  }

  _syncActions(mode) {
    const player = this.game.player;
    const vehicle = !!(player && !player.onFoot && player.vehicle);
    const air = !!(vehicle && VEHICLE_TYPES[player.vehicle.kind]?.air);
    const interaction = this._interactionState(player, vehicle);
    this._setButton('interact', { ...interaction, visible: true });

    const alternate = vehicle ? null : this._actionFor('F');
    this._setButton('alternate', vehicle
      ? { icon: 'horn', label: 'Clacson', visible: true, available: true }
      : {
          icon: alternate
            ? this._iconForAction(alternate.action.text, alternate.source, 'alternate')
            : 'alternate',
          label: alternate?.action?.text || 'Nessuna azione secondaria disponibile',
          visible: !!alternate, available: !!alternate && player?.enterCooldown <= 0,
        });

    this._setButton('brake', {
      icon: air ? 'climbUp' : 'brake',
      label: air ? 'Sali di quota' : 'Freno a mano',
      visible: vehicle, available: vehicle,
    });
    this._setButton('sprint', {
      icon: air ? 'climbDown' : 'sprint',
      label: air ? 'Scendi di quota' : 'Scatto',
      visible: !vehicle || air, available: !vehicle || air,
    });
    this._setButton('scope', {
      icon: 'scope', label: 'Mira di precisione',
      visible: !vehicle && !!player?.spec?.scope,
      available: !vehicle && !!player?.spec?.scope,
      selected: !!player?.scoping,
    });
    this._setButton('weapon', { icon: 'weapon', label: 'Cambia arma' });
    this._setButton('map', { icon: 'map', label: 'Apri la mappa' });
    this._setButton('pause', { icon: 'pause', label: 'Pausa' });
    this._setButton('radio', {
      icon: 'radio',
      label: this.game.radio?.on
        ? `Radio: ${this.game.radio.label} · tocca per cambiare, tieni premuto per spegnere`
        : 'Accendi la radio · tieni premuto per spegnere',
      visible: vehicle, available: vehicle, selected: vehicle && !!this.game.radio?.on,
    });
    void mode;
  }

  update() {
    if (!this.active || !this.root) return;
    const mode = this._mode();
    if (mode !== this.mode) {
      this._releaseHeld();
      this.mode = mode;
    }
    this.root.hidden = false;
    this.root.dataset.mode = mode;
    this._show(this._layers.play, mode === 'play');
    this._show(this._layers.nav, mode === 'title' || mode === 'menu');
    this._show(this._layers.cutscene, mode === 'cutscene' || mode === 'dialogue');
    const skip = this.buttons.get('skip');
    if (skip) skip.hidden = mode === 'dialogue';
    const hint = this._layers.cutscene?.querySelector('.mc-hint');
    if (hint) hint.textContent = mode === 'dialogue'
      ? 'Tocca la battuta per continuare'
      : 'Tocca la scena per continuare';
    this._syncActions(mode);
  }

  /** Chiamato dal gioco quando la scheda sparisce: libera stato e grafica. */
  clear() { this._releaseHeld(); }
}

export default MobileControls;
