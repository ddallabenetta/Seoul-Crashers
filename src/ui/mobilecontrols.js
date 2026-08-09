// I controlli touch sono un adattatore sottile di Input. Non conoscono il mondo:
// ogni bottone emette lo stesso fronte di tasto/mouse della tastiera e del
// puntatore desktop, così menu e partita condividono il contratto.

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
    transform: translateY(-118px);
  }
}
@media (min-width: 900px) and (orientation: landscape) {
  #mobile-controls .mc-actions { width: 270px; }
}
`;

const ACTIONS = [
  ['interact', 'E', 'Interagisci'],
  ['alternate', 'F', 'Azione alternativa'],
  ['sprint', '⇧', 'Scatto / discesa'],
  ['brake', 'Space', 'Freno / salita'],
  ['scope', 'Mira', 'Mira di precisione'],
  ['weapon', '↻', 'Cambia arma'],
  ['map', 'M', 'Mappa'],
  ['pause', 'Ⅱ', 'Pausa'],
  ['radio', 'R', 'Radio (tieni premuto per spegnere)'],
];

const NAV = [
  ['nav-up', '▲', 'Naviga su', 'ArrowUp'],
  ['nav-left', '◀', 'Naviga a sinistra', 'ArrowLeft'],
  ['nav-confirm', 'OK', 'Conferma', 'Enter'],
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
    for (const [id, label, aria] of ACTIONS) {
      const button = this._button(actions, id, label, aria, 'mc-held');
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
      const actualCode = typeof code === 'function' ? code() : code;
      this.input.press(actualCode, source);
      this.input.release(actualCode, source);
    });
  }

  _bindAction(button, id) {
    if (id === 'weapon') {
      const action = (e) => { e.preventDefault(); e.stopPropagation(); this.input.virtualWheel(1); };
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
      this.input.press('KeyR', source);
      this.input.release('KeyR', source);
    });
    this._radioState = state;
  }

  _bindMouse(button, buttonCode, source) {
    const begin = (e) => {
      e.preventDefault(); e.stopPropagation();
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
      if (e.detail === 0) { this.input.setRight(true, source); this.input.setRight(false, source); }
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

  _labels(mode) {
    const player = this.game.player;
    const vehicle = !!(player && !player.onFoot && player.vehicle);
    const alternate = this.buttons.get('alternate');
    const brake = this.buttons.get('brake');
    const sprint = this.buttons.get('sprint');
    const scope = this.buttons.get('scope');
    if (alternate) {
      alternate.textContent = vehicle ? 'H' : 'F';
      alternate.setAttribute('aria-label', vehicle ? 'Clacson' : 'Azione alternativa');
      alternate.title = vehicle ? 'Clacson' : 'Azione alternativa';
    }
    if (brake) {
      brake.hidden = !vehicle;
      brake.textContent = vehicle && player.vehicle?.air ? 'Space' : 'Freno';
      brake.setAttribute('aria-label', vehicle && player.vehicle?.air ? 'Sali' : 'Freno a mano');
    }
    if (sprint) {
      sprint.hidden = vehicle && !player.vehicle?.air;
      sprint.textContent = vehicle && player.vehicle?.air ? 'Shift' : '⇧';
      sprint.setAttribute('aria-label', vehicle && player.vehicle?.air ? 'Scendi' : 'Scatto');
      sprint.title = vehicle && player.vehicle?.air ? 'Scendi' : 'Scatto';
    }
    if (scope) scope.hidden = vehicle;
    const radio = this.buttons.get('radio');
    if (radio) {
      radio.setAttribute('aria-label', 'Radio: tocca per cambiare, tieni premuto per spegnere');
      radio.title = 'Tocca: cambia stazione · Tieni premuto: spegni';
    }
    // Mappa, pausa e radio restano visibili in partita: servono anche senza
    // un'arma o un'interazione vicina. Le etichette cambiano col contesto.
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
    this._show(this._layers.cutscene, mode === 'cutscene');
    this._labels(mode);
  }

  /** Chiamato dal gioco quando la scheda sparisce: libera stato e grafica. */
  clear() { this._releaseHeld(); }
}

export default MobileControls;
