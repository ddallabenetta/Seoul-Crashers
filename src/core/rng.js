// Generatore pseudo-casuale deterministico: la stessa seed produce sempre la stessa Seoul.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed = 20260730) {
    this.next = mulberry32(seed);
  }
  /** float in [a, b) */
  range(a, b) {
    return a + this.next() * (b - a);
  }
  /** int in [a, b] */
  int(a, b) {
    return Math.floor(this.range(a, b + 1));
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** true con probabilità p */
  chance(p) {
    return this.next() < p;
  }
  /** distribuzione a campana grezza, media 0, range circa [-1,1] */
  bell() {
    return (this.next() + this.next() + this.next() - 1.5) / 1.5;
  }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
