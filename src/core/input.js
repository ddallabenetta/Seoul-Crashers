// Input condiviso fra tastiera, puntatore e i controlli touch virtuali.
//
// Il gioco continua a leggere lo stesso contratto di prima (`down`, `mouse` e
// `wasPressed`): le sorgenti nuove vengono unite qui, così un bottone virtuale
// non può lasciare un tasto «incastrato» e la tastiera desktop resta invariata.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyF', 'KeyR', 'KeyH', 'KeyC',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Tab', 'Escape', 'Enter',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
]);

const POINTER_LEFT = 'left';
const POINTER_RIGHT = 'right';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.mouse = { x: 0, y: 0, down: false, pressed: false, released: false, wheel: 0, right: false };
    this.enabled = true;

    // Le sorgenti separate servono quando, per esempio, Shift resta premuto
    // sulla tastiera mentre si rilascia il bottone virtuale dello scatto.
    this._keyboardDown = new Set();
    this._virtualDown = new Set();
    this._virtualSources = new Map();
    this._virtualMove = { x: 0, y: 0 };
    this._virtualAim = null;
    this._virtualMouse = { left: new Set(), right: new Set() };
    this._pointers = new Map();
    this._touches = new Map();
    this._pinchDistance = 0;
    this._pointerSeq = 0;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this._setKey(e.code, 'keyboard', true);
    });

    window.addEventListener('keyup', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this._setKey(e.code, 'keyboard', false);
    });

    window.addEventListener('blur', () => this.clearAll());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.clearAll();
      });
    }

    // Pointer Events copre mouse, penna e touch con un solo percorso. Aggiornare
    // le coordinate prima di impostare `pressed` è intenzionale: un tap che
    // comincia e finisce fra due tick deve comunque mirare al punto giusto.
    canvas.addEventListener('pointermove', (e) => this._pointerMove(e));
    canvas.addEventListener('pointerdown', (e) => this._pointerDown(e));
    canvas.addEventListener('pointerup', (e) => this._pointerUp(e));
    canvas.addEventListener('pointercancel', (e) => this._pointerCancel(e));
    canvas.addEventListener('lostpointercapture', (e) => this._pointerCancel(e));
    window.addEventListener('pointerup', (e) => this._pointerUp(e));
    window.addEventListener('pointercancel', (e) => this._pointerCancel(e));

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      this.virtualWheel(e.deltaY);
    }, { passive: false });
  }

  _setKey(code, source, active) {
    if (!code) return;
    const wasDown = this.down.has(code);
    if (source === 'keyboard') {
      if (active) this._keyboardDown.add(code);
      else this._keyboardDown.delete(code);
    } else {
      let sources = this._virtualSources.get(code);
      if (active) {
        if (!sources) {
          sources = new Set();
          this._virtualSources.set(code, sources);
        }
        sources.add(source || 'virtual');
      } else if (sources) {
        sources.delete(source || 'virtual');
        if (!sources.size) this._virtualSources.delete(code);
      }
      if (this._virtualSources.has(code)) this._virtualDown.add(code);
      else this._virtualDown.delete(code);
    }
    const isDown = this._keyboardDown.has(code) || this._virtualDown.has(code);
    if (isDown) this.down.add(code);
    else this.down.delete(code);
    if (!wasDown && isDown) this.justPressed.add(code);
    if (wasDown && !isDown) this.justReleased.add(code);
  }

  _setMouseButton(button, source, active) {
    const key = button === 2 ? POINTER_RIGHT : POINTER_LEFT;
    const set = this._virtualMouse[key];
    const wasDown = key === POINTER_LEFT ? this.mouse.down : this.mouse.right;
    if (active) set.add(source);
    else set.delete(source);
    const isDown = set.size > 0;
    if (key === POINTER_LEFT) this.mouse.down = isDown;
    else this.mouse.right = isDown;
    if (!wasDown && isDown) {
      if (key === POINTER_LEFT) this.mouse.pressed = true;
    } else if (wasDown && !isDown) {
      if (key === POINTER_LEFT) this.mouse.released = true;
    }
  }

  _point(e) {
    const r = this.canvas.getBoundingClientRect();
    // Il rettangolo può avere dimensione zero per un istante durante la
    // rotazione. La coordinata client resta utile; il limite spetta ai chiamanti.
    return {
      x: (Number.isFinite(e.clientX) ? e.clientX : (e.offsetX || 0)) - r.left,
      y: (Number.isFinite(e.clientY) ? e.clientY : (e.offsetY || 0)) - r.top,
    };
  }

  _updatePoint(e) {
    const p = this._point(e);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    return p;
  }

  _pointerMove(e) {
    if (!this.enabled) return;
    const p = this._updatePoint(e);
    const rec = this._pointers.get(e.pointerId);
    if (rec) {
      rec.x = p.x;
      rec.y = p.y;
      if (rec.touch) this._touches.set(e.pointerId, rec);
    }
    if (e.pointerType === 'touch') {
      this._updatePinch(e);
      e.preventDefault();
    }
  }

  _pointerDown(e) {
    if (!this.enabled) return;
    const p = this._updatePoint(e);
    const touch = e.pointerType === 'touch';
    const rec = { id: e.pointerId, x: p.x, y: p.y, touch, button: e.button };
    this._pointers.set(e.pointerId, rec);
    if (touch) this._touches.set(e.pointerId, rec);
    try { this.canvas.setPointerCapture?.(e.pointerId); } catch (_) { /* WebKit vecchio */ }

    // Un tap sulla tavola resta un clic sinistro per menu e cutscene. Con due
    // dita diventa un gesto pinch, non uno sparo accidentale.
    if (e.button === 0 || touch) {
      if (!touch || this._touches.size === 1) {
        this._setMouseButton(0, `pointer:${e.pointerId}`, true);
      }
    } else if (e.button === 2) {
      this._setMouseButton(2, `pointer:${e.pointerId}`, true);
    }
    if (this._touches.size >= 2) {
      this._setMouseButton(0, `pointer:${[...this._touches.keys()][0]}`, false);
      this._pinchDistance = this._touchDistance();
    }
    if (touch) e.preventDefault();
  }

  _pointerUp(e) {
    const rec = this._pointers.get(e.pointerId);
    if (!rec) return;
    if (this.enabled) this._updatePoint(e);
    this._pointers.delete(e.pointerId);
    if (rec.touch) this._touches.delete(e.pointerId);
    this._setMouseButton(rec.button === 2 ? 2 : 0, `pointer:${e.pointerId}`, false);
    if (this._touches.size < 2) this._pinchDistance = 0;
    try { this.canvas.releasePointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
    if (rec.touch) e.preventDefault();
  }

  _pointerCancel(e) {
    const rec = this._pointers.get(e.pointerId);
    if (!rec) return;
    this._pointers.delete(e.pointerId);
    if (rec.touch) this._touches.delete(e.pointerId);
    this._setMouseButton(rec.button === 2 ? 2 : 0, `pointer:${e.pointerId}`, false);
    if (this._touches.size < 2) this._pinchDistance = 0;
    try { this.canvas.releasePointerCapture?.(e.pointerId); } catch (_) { /* niente */ }
    e.preventDefault?.();
  }

  _touchDistance() {
    const values = [...this._touches.values()];
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  _updatePinch(e) {
    if (this._touches.size < 2) return;
    const distance = this._touchDistance();
    if (!this._pinchDistance) {
      this._pinchDistance = distance;
      return;
    }
    const delta = distance - this._pinchDistance;
    // La mappa consuma già la rotella come uno scatto di zoom. Una soglia piccola
    // evita che il sensore touch rumoroso produca una dozzina di zoom per frame.
    if (Math.abs(delta) >= 8) {
      this.virtualWheel(delta > 0 ? -1 : 1);
      this._pinchDistance = distance;
    }
    void e;
  }

  isDown(code) {
    return this.down.has(code);
  }

  /** true solo nel frame in cui il tasto è stato premuto */
  wasPressed(code) {
    return this.justPressed.has(code);
  }

  anyDown(...codes) {
    return codes.some((c) => this.down.has(c));
  }

  /** Asse -1..1 su due tasti, con l'eventuale leva analogica virtuale. */
  axis(negCodes, posCodes) {
    const n = negCodes.some((c) => this.down.has(c)) ? 1 : 0;
    const p = posCodes.some((c) => this.down.has(c)) ? 1 : 0;
    let value = p - n;
    const horizontal = negCodes.includes('KeyA') || negCodes.includes('ArrowLeft')
      || posCodes.includes('KeyD') || posCodes.includes('ArrowRight');
    const vertical = negCodes.includes('KeyW') || negCodes.includes('ArrowUp')
      || posCodes.includes('KeyS') || posCodes.includes('ArrowDown');
    if (horizontal) value = Math.abs(this._virtualMove.x) > Math.abs(value)
      ? this._virtualMove.x : value;
    if (vertical) {
      const vy = this._virtualMove.y;
      value = Math.abs(vy) > Math.abs(value) ? vy : value;
    }
    return Math.max(-1, Math.min(1, value));
  }

  /** Vettore di movimento normalizzato da WASD/frecce e leva virtuale. */
  moveVector() {
    const x = this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const y = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const l = Math.hypot(x, y);
    if (l > 1) return { x: x / l, y: y / l, len: 1 };
    return { x, y, len: l };
  }

  // --- API per i controlli virtuali ---------------------------------------
  press(code, source = 'virtual') { this._setKey(code, source, true); }
  release(code, source = 'virtual') { this._setKey(code, source, false); }
  pressKey(code, source) { this.press(code, source); }
  releaseKey(code, source) { this.release(code, source); }
  setVirtualKey(code, active, source) { active ? this.press(code, source) : this.release(code, source); }
  virtualPress(code, source) { this.press(code, source); }
  virtualRelease(code, source) { this.release(code, source); }

  setMove(x = 0, y = 0) {
    this._virtualMove.x = Math.max(-1, Math.min(1, Number(x) || 0));
    this._virtualMove.y = Math.max(-1, Math.min(1, Number(y) || 0));
    return this._virtualMove;
  }
  virtualMove(x = 0, y = 0) { return this.setMove(x, y); }
  setVirtualMove(x = 0, y = 0) { return this.setMove(x, y); }

  setAim(x, y) {
    if (x && typeof x === 'object') ({ x, y } = x);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.mouse.x = x;
    this.mouse.y = y;
    this._virtualAim = { x, y };
  }
  virtualAim(x, y) { this.setAim(x, y); }
  setVirtualAim(x, y) { this.setAim(x, y); }
  recenterAim(w = this.canvas.clientWidth || 0, h = this.canvas.clientHeight || 0) {
    this.setAim(w * 0.5, h * 0.5);
  }

  setFire(active, source = 'virtual-fire') {
    this._setMouseButton(0, source, !!active);
  }
  virtualFire(active, source = 'virtual-fire') { this.setFire(active, source); }
  setVirtualFire(active, source = 'virtual-fire') { this.setFire(active, source); }
  setRight(active, source = 'virtual-right') {
    this._setMouseButton(2, source, !!active);
  }
  virtualRight(active, source = 'virtual-right') { this.setRight(active, source); }
  setVirtualRight(active, source = 'virtual-right') { this.setRight(active, source); }
  virtualWheel(delta = 1) { this.mouse.wheel += Math.sign(Number(delta) || 0); }
  setWheel(delta = 1) { this.virtualWheel(delta); }
  setVirtualWheel(delta = 1) { this.virtualWheel(delta); }

  /** Svuota solo lo stato virtuale (serve quando cambia modalità). */
  clearVirtual() {
    for (const code of [...this._virtualDown]) {
      const sources = [...(this._virtualSources.get(code) || [])];
      for (const source of sources) this._setKey(code, source, false);
    }
    this._virtualSources.clear();
    this._virtualDown.clear();
    for (const source of [...this._virtualMouse.left]) this._setMouseButton(0, source, false);
    for (const source of [...this._virtualMouse.right]) this._setMouseButton(2, source, false);
    this.setMove(0, 0);
    this._virtualAim = null;
  }

  /** Svuota ogni sorgente, anche i puntatori catturati, dopo blur/cancel/hidden. */
  clearAll() {
    const released = new Set([...this.down]);
    const mouseWasDown = this.mouse.down;
    this._keyboardDown.clear();
    this.clearVirtual();
    this._pointers.clear();
    this._touches.clear();
    this._pinchDistance = 0;
    this.down.clear();
    for (const code of released) this.justReleased.add(code);
    this.mouse.down = false;
    this.mouse.right = false;
    if (this.mouse.pressed || mouseWasDown) this.mouse.released = true;
    this.mouse.pressed = false;
  }

  clearInputs() { this.clearAll(); }

  endFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
    this.mouse.pressed = false;
    this.mouse.released = false;
    this.mouse.wheel = 0;
  }
}

export { GAME_KEYS };
