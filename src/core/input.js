// Gestione input: tastiera + mouse. Espone stato continuo (down) e a fronte (pressed).
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyQ', 'KeyM', 'KeyF', 'KeyR', 'KeyH', 'KeyC',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Tab', 'Escape', 'Enter',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
]);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.mouse = { x: 0, y: 0, down: false, pressed: false, released: false, wheel: 0, right: false };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.justPressed.add(e.code);
    });

    window.addEventListener('keyup', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      this.down.delete(e.code);
      this.justReleased.add(e.code);
    });

    window.addEventListener('blur', () => {
      this.down.clear();
      this.mouse.down = false;
    });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });

    canvas.addEventListener('mousedown', (e) => {
      e.preventDefault();
      if (e.button === 0) {
        this.mouse.down = true;
        this.mouse.pressed = true;
      } else if (e.button === 2) {
        this.mouse.right = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouse.down = false;
        this.mouse.released = true;
      } else if (e.button === 2) {
        this.mouse.right = false;
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mouse.wheel += Math.sign(e.deltaY);
    }, { passive: false });
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

  /** Asse -1..1 su due tasti */
  axis(negCodes, posCodes) {
    const n = negCodes.some((c) => this.down.has(c)) ? 1 : 0;
    const p = posCodes.some((c) => this.down.has(c)) ? 1 : 0;
    return p - n;
  }

  /** Vettore di movimento normalizzato da WASD/frecce */
  moveVector() {
    const x = this.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight']);
    const y = this.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown']);
    const l = Math.hypot(x, y);
    if (l > 1) return { x: x / l, y: y / l, len: 1 };
    return { x, y, len: l };
  }

  endFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
    this.mouse.pressed = false;
    this.mouse.released = false;
    this.mouse.wheel = 0;
  }
}
