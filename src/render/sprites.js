// Sprite illustrati generati da codice su canvas offscreen e messi in cache.
// Ogni sprite è disegnato con il "davanti" verso +x (angolo 0 = est).
const SS = 2; // supersampling: disegno a 2x, uso a 1x -> bordi puliti
const cache = new Map();

export function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3
    ? h.split('').map((c) => parseInt(c + c, 16))
    : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return v;
}

/** amt > 0 schiarisce, amt < 0 scurisce. */
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt > 0 ? 255 : 0;
  const p = Math.abs(amt);
  return `rgb(${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)})`;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function sprite(key, w, h, draw) {
  let s = cache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * SS));
  c.height = Math.max(1, Math.ceil(h * SS));
  const g = c.getContext('2d');
  g.scale(SS, SS);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g, w, h);
  s = { canvas: c, w, h };
  cache.set(key, s);
  return s;
}

// ---------------------------------------------------------------------------
// VEICOLI
// ---------------------------------------------------------------------------
export const VEHICLE_TYPES = {
  hatch:   { len: 66, wid: 30, mass: 0.85, topSpeed: 300, accel: 235, grip: 1.02, hp: 100, cabin: [0.30, 0.66], label: 'utilitaria' },
  sedan:   { len: 78, wid: 32, mass: 1.0,  topSpeed: 330, accel: 220, grip: 1.0,  hp: 115, cabin: [0.30, 0.62], label: 'berlina' },
  taxi:    { len: 78, wid: 32, mass: 1.0,  topSpeed: 325, accel: 225, grip: 1.0,  hp: 115, cabin: [0.30, 0.62], label: 'taxi' },
  suv:     { len: 88, wid: 36, mass: 1.35, topSpeed: 315, accel: 205, grip: 0.94, hp: 155, cabin: [0.28, 0.68], label: 'suv' },
  sport:   { len: 80, wid: 34, mass: 0.95, topSpeed: 440, accel: 300, grip: 1.12, hp: 100, cabin: [0.32, 0.58], label: 'sportiva' },
  van:     { len: 96, wid: 36, mass: 1.5,  topSpeed: 280, accel: 175, grip: 0.9,  hp: 175, cabin: [0.52, 0.86], label: 'furgone' },
  truck:   { len: 132, wid: 40, mass: 2.4, topSpeed: 250, accel: 140, grip: 0.82, hp: 240, cabin: [0.62, 0.92], label: 'camion' },
  bus:     { len: 158, wid: 41, mass: 2.8, topSpeed: 235, accel: 125, grip: 0.78, hp: 280, cabin: [0.0, 1.0], label: 'autobus' },
  scooter: { len: 44, wid: 17, mass: 0.4,  topSpeed: 290, accel: 260, grip: 1.05, hp: 45,  cabin: [0.3, 0.6], label: 'scooter' },
  police:  { len: 82, wid: 34, mass: 1.1,  topSpeed: 380, accel: 260, grip: 1.06, hp: 150, cabin: [0.30, 0.62], label: 'volante' },
  swat:    { len: 100, wid: 38, mass: 1.9, topSpeed: 320, accel: 200, grip: 0.95, hp: 260, cabin: [0.55, 0.88], label: 'furgone SWAT' },
};

export const VEHICLE_COLORS = [
  '#d9dde3', '#2f3339', '#8e939b', '#b8bec6', '#2c4a72',
  '#8f2f2f', '#1f4d3d', '#5a4a7a', '#c0a24a', '#3d3f44',
];

const GLASS_DARK = '#141a22';

function drawWheels(g, w, h, spec) {
  const ww = Math.max(8, w * 0.14);
  const wh = Math.max(4, h * 0.17);
  g.fillStyle = '#15171a';
  const xs = [w * 0.18, w * 0.74];
  for (const x of xs) {
    roundRect(g, x, -1.5, ww, wh + 1.5, 2); g.fill();
    roundRect(g, x, h - wh, ww, wh + 1.5, 2); g.fill();
  }
}

function drawCarBody(g, w, h, color, spec, opts = {}) {
  const inset = 2.5;
  drawWheels(g, w, h, spec);

  // Corpo con luce da nord-ovest.
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.34));
  grad.addColorStop(0.35, shade(color, 0.1));
  grad.addColorStop(0.62, color);
  grad.addColorStop(1, shade(color, -0.34));
  g.fillStyle = grad;
  const r = opts.boxy ? 5 : Math.min(h * 0.42, 13);
  roundRect(g, inset, inset, w - inset * 2, h - inset * 2, r);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 1.6;
  g.stroke();

  // Muso e coda leggermente più scuri (superfici inclinate).
  g.fillStyle = 'rgba(0,0,0,0.14)';
  roundRect(g, w - w * 0.13, inset + 1, w * 0.1, h - inset * 2 - 2, 4); g.fill();
  roundRect(g, inset + 1, inset + 1, w * 0.09, h - inset * 2 - 2, 4); g.fill();

  // Abitacolo
  const [c0, c1] = spec.cabin;
  const cabX = w * c0;
  const cabW = w * (c1 - c0);
  const cabInset = h * 0.13;
  g.fillStyle = shade(color, -0.16);
  roundRect(g, cabX, cabInset, cabW, h - cabInset * 2, 5);
  g.fill();

  // Parabrezza (verso il muso) e lunotto
  const gg = g.createLinearGradient(cabX, 0, cabX + cabW, h);
  gg.addColorStop(0, '#28323d');
  gg.addColorStop(0.5, GLASS_DARK);
  gg.addColorStop(1, '#3a4854');
  g.fillStyle = gg;
  roundRect(g, cabX + cabW * 0.66, cabInset + 1.5, cabW * 0.3, h - cabInset * 2 - 3, 3); g.fill();
  roundRect(g, cabX + cabW * 0.04, cabInset + 1.5, cabW * 0.24, h - cabInset * 2 - 3, 3); g.fill();

  // Tetto
  g.fillStyle = shade(color, 0.06);
  roundRect(g, cabX + cabW * 0.3, cabInset + 1, cabW * 0.34, h - cabInset * 2 - 2, 3); g.fill();

  // Riflesso speculare diagonale
  g.save();
  g.globalAlpha = 0.16;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.2);
  g.lineTo(w * 0.9, h * 0.12);
  g.lineTo(w * 0.9, h * 0.2);
  g.lineTo(w * 0.1, h * 0.3);
  g.closePath();
  g.fill();
  g.restore();

  // Specchietti
  g.fillStyle = shade(color, -0.28);
  roundRect(g, cabX + cabW * 0.62, -1.5, w * 0.05, 3.5, 1.5); g.fill();
  roundRect(g, cabX + cabW * 0.62, h - 2, w * 0.05, 3.5, 1.5); g.fill();

  // Fari e fanali
  g.fillStyle = '#ffeec2';
  roundRect(g, w - 6.5, h * 0.16, 4.5, h * 0.16, 1.6); g.fill();
  roundRect(g, w - 6.5, h * 0.68, 4.5, h * 0.16, 1.6); g.fill();
  g.fillStyle = '#c33a33';
  roundRect(g, 2.5, h * 0.15, 3.5, h * 0.17, 1.4); g.fill();
  roundRect(g, 2.5, h * 0.68, 3.5, h * 0.17, 1.4); g.fill();

  // Targa
  g.fillStyle = '#e8e6dd';
  g.fillRect(w - 4, h * 0.44, 2.5, h * 0.12);
}

function drawBoxVehicle(g, w, h, color, spec, opts) {
  drawWheels(g, w, h, spec);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.3));
  grad.addColorStop(0.4, shade(color, 0.08));
  grad.addColorStop(1, shade(color, -0.32));
  g.fillStyle = grad;
  roundRect(g, 2, 2, w - 4, h - 4, 5);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 1.6;
  g.stroke();

  const [c0, c1] = spec.cabin;
  // Cabina
  g.fillStyle = shade(color, -0.1);
  roundRect(g, w * c0, 3, w * (c1 - c0), h - 6, 4); g.fill();
  // Parabrezza
  const gg = g.createLinearGradient(0, 0, 0, h);
  gg.addColorStop(0, '#2b3540');
  gg.addColorStop(1, GLASS_DARK);
  g.fillStyle = gg;
  roundRect(g, w * c1 - w * 0.055, h * 0.14, w * 0.04, h * 0.72, 2); g.fill();

  // Cassone: nervature
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  const bodyEnd = w * c0 - 3;
  for (let x = 6; x < bodyEnd; x += 9) {
    g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke();
  }
  if (opts && opts.livery) {
    g.fillStyle = opts.livery;
    g.fillRect(4, h * 0.42, bodyEnd - 4, h * 0.16);
  }
  // Fari
  g.fillStyle = '#ffeec2';
  roundRect(g, w - 6, h * 0.14, 4, h * 0.16, 1.5); g.fill();
  roundRect(g, w - 6, h * 0.7, 4, h * 0.16, 1.5); g.fill();
  g.fillStyle = '#c33a33';
  roundRect(g, 3, h * 0.14, 3, h * 0.16, 1.4); g.fill();
  roundRect(g, 3, h * 0.7, 3, h * 0.16, 1.4); g.fill();
}

function drawBus(g, w, h, color) {
  const spec = VEHICLE_TYPES.bus;
  drawWheels(g, w, h, spec);
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.28));
  grad.addColorStop(0.45, color);
  grad.addColorStop(1, shade(color, -0.34));
  g.fillStyle = grad;
  roundRect(g, 2, 2, w - 4, h - 4, 7); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.6; g.stroke();

  // Fascia finestre lungo tutta la fiancata
  g.fillStyle = '#1b232c';
  roundRect(g, w * 0.1, 4.5, w * 0.82, h * 0.12, 2); g.fill();
  roundRect(g, w * 0.1, h - 4.5 - h * 0.12, w * 0.82, h * 0.12, 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.12)';
  for (let x = w * 0.12; x < w * 0.9; x += w * 0.09) {
    g.fillRect(x, 5, w * 0.055, h * 0.1);
    g.fillRect(x, h - 5 - h * 0.1, w * 0.055, h * 0.1);
  }
  // Parabrezza
  const gg = g.createLinearGradient(w * 0.9, 0, w, h);
  gg.addColorStop(0, '#2f3a45'); gg.addColorStop(1, GLASS_DARK);
  g.fillStyle = gg;
  roundRect(g, w * 0.92, 5, w * 0.05, h - 10, 3); g.fill();
  // Tetto con condotti
  g.fillStyle = 'rgba(255,255,255,0.07)';
  g.fillRect(w * 0.15, h * 0.38, w * 0.7, h * 0.24);
  g.fillStyle = '#ffeec2';
  roundRect(g, w - 6, h * 0.12, 4, h * 0.14, 1.5); g.fill();
  roundRect(g, w - 6, h * 0.74, 4, h * 0.14, 1.5); g.fill();
}

function drawScooter(g, w, h, color) {
  g.fillStyle = '#15171a';
  roundRect(g, w * 0.06, h * 0.28, w * 0.16, h * 0.44, 2); g.fill();
  roundRect(g, w * 0.76, h * 0.28, w * 0.16, h * 0.44, 2); g.fill();
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.3));
  grad.addColorStop(1, shade(color, -0.3));
  g.fillStyle = grad;
  roundRect(g, w * 0.2, h * 0.18, w * 0.6, h * 0.64, 4); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke();
  // Manubrio
  g.strokeStyle = '#2a2d31'; g.lineWidth = 2.6;
  g.beginPath(); g.moveTo(w * 0.7, -1); g.lineTo(w * 0.7, h + 1); g.stroke();
  // Sella
  g.fillStyle = '#22242a';
  roundRect(g, w * 0.3, h * 0.26, w * 0.26, h * 0.48, 3); g.fill();
  // Bauletto delivery
  g.fillStyle = shade(color, -0.1);
  roundRect(g, w * 0.08, h * 0.14, w * 0.2, h * 0.72, 2); g.fill();
  g.fillStyle = '#ffeec2';
  roundRect(g, w - 4, h * 0.4, 3, h * 0.2, 1); g.fill();
}

function drawTaxiExtras(g, w, h) {
  // Livrea Seoul: fascia scura + insegna sul tetto
  g.fillStyle = 'rgba(30,34,40,0.9)';
  g.fillRect(w * 0.08, h * 0.02, w * 0.84, h * 0.06);
  g.fillRect(w * 0.08, h * 0.92, w * 0.84, h * 0.06);
  g.fillStyle = '#f3e6c8';
  roundRect(g, w * 0.42, h * 0.36, w * 0.13, h * 0.28, 2); g.fill();
  g.fillStyle = '#c98b2a';
  g.fillRect(w * 0.44, h * 0.42, w * 0.09, h * 0.16);
}

function drawPoliceExtras(g, w, h) {
  // Livrea bianca/blu + barra luminosa
  g.fillStyle = '#1c3f8f';
  g.fillRect(w * 0.06, h * 0.03, w * 0.88, h * 0.07);
  g.fillRect(w * 0.06, h * 0.9, w * 0.88, h * 0.07);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = 'bold 7px sans-serif';
  g.textAlign = 'center';
  g.fillText('POLICE', w * 0.5, h * 0.14);
  g.save();
  g.translate(w * 0.5, h * 0.5); g.rotate(Math.PI); g.textAlign = 'center';
  g.fillText('경찰', 0, h * 0.36);
  g.restore();
  // Barra lampeggiante (i colori vivi li aggiunge il renderer)
  g.fillStyle = '#2a2d33';
  roundRect(g, w * 0.4, h * 0.2, w * 0.1, h * 0.6, 2); g.fill();
  g.fillStyle = '#7a1f22';
  g.fillRect(w * 0.41, h * 0.22, w * 0.08, h * 0.26);
  g.fillStyle = '#1b3a7a';
  g.fillRect(w * 0.41, h * 0.52, w * 0.08, h * 0.26);
}

export function getVehicleSprite(kind, colorIndex = 0) {
  const spec = VEHICLE_TYPES[kind] || VEHICLE_TYPES.sedan;
  let color = VEHICLE_COLORS[colorIndex % VEHICLE_COLORS.length];
  if (kind === 'taxi') color = ['#d98f2b', '#c3c8cf', '#2f5f9e'][colorIndex % 3];
  if (kind === 'bus') color = ['#2f6fb5', '#3f8f5a', '#c9a13c'][colorIndex % 3];
  if (kind === 'police') color = '#e8ecf2';
  if (kind === 'swat') color = '#2b3138';
  if (kind === 'truck') color = ['#7b8288', '#4a5560', '#8f6a42'][colorIndex % 3];

  const key = `veh:${kind}:${colorIndex}`;
  const pad = 4;
  return sprite(key, spec.len + pad, spec.wid + pad * 1.6, (g, w, h) => {
    g.translate(pad / 2, pad * 0.8);
    const iw = spec.len;
    const ih = spec.wid;
    if (kind === 'bus') drawBus(g, iw, ih, color);
    else if (kind === 'scooter') drawScooter(g, iw, ih, color);
    else if (kind === 'truck' || kind === 'van' || kind === 'swat') {
      drawBoxVehicle(g, iw, ih, color, spec, { livery: kind === 'swat' ? '#1c3f8f' : null });
      if (kind === 'swat') {
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.font = 'bold 8px sans-serif';
        g.textAlign = 'center';
        g.fillText('SWAT', iw * 0.3, ih * 0.55);
      }
    } else {
      drawCarBody(g, iw, ih, color, spec, { boxy: kind === 'suv' });
      if (kind === 'taxi') drawTaxiExtras(g, iw, ih);
      if (kind === 'police') drawPoliceExtras(g, iw, ih);
    }
  });
}

/** Sprite del relitto: usato quando il veicolo è distrutto. */
export function getWreckSprite(kind) {
  const spec = VEHICLE_TYPES[kind] || VEHICLE_TYPES.sedan;
  return sprite(`wreck:${kind}`, spec.len + 4, spec.wid + 6, (g, w, h) => {
    g.translate(2, 3);
    const iw = spec.len, ih = spec.wid;
    g.fillStyle = '#26282b';
    roundRect(g, 2, 2, iw - 4, ih - 4, 6); g.fill();
    g.fillStyle = '#17181a';
    for (let i = 0; i < 9; i++) {
      const x = 4 + (i * iw) / 10;
      g.beginPath();
      g.ellipse(x, ih / 2 + Math.sin(i) * ih * 0.2, iw * 0.06, ih * 0.22, i, 0, 6.283);
      g.fill();
    }
    g.strokeStyle = 'rgba(120,90,60,0.35)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(iw * 0.2 * i, 3);
      g.lineTo(iw * 0.2 * i + 6, ih - 3);
      g.stroke();
    }
  });
}

// ---------------------------------------------------------------------------
// PEDONI
// ---------------------------------------------------------------------------
export const PED_KINDS = {
  civil:    { coats: ['#5a6472', '#7a5f52', '#4e6b5c', '#6a5a72', '#8a7a5a'], pants: '#3a3f47', hair: '#1c1a1a', speed: 46, bag: 0.2, hp: 30 },
  office:   { coats: ['#2f3540', '#38404d', '#4a4a52', '#2b3a44'], pants: '#23262c', hair: '#181717', speed: 52, bag: 0.65, case: true, hp: 30 },
  student:  { coats: ['#c25a7a', '#4a8fc2', '#d2a03f', '#5ac28f', '#8f5ac2'], pants: '#3d4650', hair: '#221c1c', speed: 58, bag: 0.9, hp: 28 },
  tourist:  { coats: ['#d9d4c8', '#e0a85c', '#8fc2d9', '#c9d98f'], pants: '#7d7f86', hair: '#3a2c22', speed: 40, bag: 0.7, cap: true, hp: 28 },
  worker:   { coats: ['#c9942f', '#d9d24a', '#b5651f'], pants: '#4a4f57', hair: '#1d1b1b', speed: 44, bag: 0.15, helmet: true, hp: 38 },
  gangster: { coats: ['#1f2126', '#2a1f24', '#26282e'], pants: '#1a1c20', hair: '#141414', speed: 54, bag: 0.1, hp: 62, fights: true },
  cop:      { coats: ['#243a63', '#1f3357'], pants: '#1b2436', hair: '#171717', speed: 56, bag: 0.1, helmet: false, hp: 75, fights: true },
  // Jae-min Seo: bomber nero con fascia rossa, il colpo d'occhio del giocatore.
  player:   { coats: ['#242629', '#2b1f22'], pants: '#1d2026', hair: '#12100f', speed: 62, bag: 0.1, hero: true },
};

export const PED_FRAMES = 8;

export function getPedSprite(kind, colorIndex = 0, frame = 0) {
  const k = PED_KINDS[kind] || PED_KINDS.civil;
  const coat = k.coats[colorIndex % k.coats.length];
  const key = `ped:${kind}:${colorIndex}:${frame}`;
  const W = 34, H = 30;
  return sprite(key, W, H, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const ph = Math.sin((frame / PED_FRAMES) * Math.PI * 2);
    const ph2 = Math.sin((frame / PED_FRAMES) * Math.PI * 2 + Math.PI);

    // Gambe (si muovono lungo l'asse di marcia)
    g.fillStyle = k.pants;
    roundRect(g, cx - 5 + ph * 3.4, cy - 6.4, 9, 4.4, 2); g.fill();
    roundRect(g, cx - 5 + ph2 * 3.4, cy + 2, 9, 4.4, 2); g.fill();

    // Braccia
    g.fillStyle = shade(coat, -0.18);
    roundRect(g, cx - 3 + ph2 * 3.2, cy - 8.6, 8, 3.6, 1.8); g.fill();
    roundRect(g, cx - 3 + ph * 3.2, cy + 5, 8, 3.6, 1.8); g.fill();

    // Torso: ellisse con luce dall'alto
    const grad = g.createLinearGradient(cx, cy - 8, cx, cy + 8);
    grad.addColorStop(0, shade(coat, 0.22));
    grad.addColorStop(0.55, coat);
    grad.addColorStop(1, shade(coat, -0.3));
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, 7.6, 6.2, 0, 0, 6.2832);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 1.3;
    g.stroke();

    // Zaino / borsa
    if (k.bag > 0.5) {
      g.fillStyle = shade(coat, -0.45);
      roundRect(g, cx - 6.5, cy - 3.4, 5.2, 6.8, 2); g.fill();
    }
    if (k.case) {
      g.fillStyle = '#2b2119';
      roundRect(g, cx - 1, cy + 6.4, 5.5, 3.6, 1); g.fill();
    }

    // Testa
    const hg = g.createRadialGradient(cx + 2.4, cy - 1.6, 0.6, cx + 2, cy, 5.4);
    hg.addColorStop(0, shade(k.hair, 0.35));
    hg.addColorStop(1, k.hair);
    g.fillStyle = hg;
    g.beginPath();
    g.arc(cx + 2, cy, 4.9, 0, 6.2832);
    g.fill();
    // Accenno di viso verso la direzione di marcia
    g.fillStyle = '#d8ab86';
    g.beginPath();
    g.arc(cx + 4.6, cy, 2.4, -1.2, 1.2);
    g.fill();
    if (k.helmet) {
      g.fillStyle = '#e8c33a';
      g.beginPath(); g.arc(cx + 2, cy, 5.6, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(cx + 4.6, cy - 5.6, 2.6, 11.2);
    }
    if (k.cap) {
      g.fillStyle = '#c9483a';
      g.beginPath(); g.arc(cx + 2, cy, 5.2, 0, 6.2832); g.fill();
      g.fillStyle = shade('#c9483a', -0.3);
      roundRect(g, cx + 6, cy - 3.4, 3.2, 6.8, 1.4); g.fill();
    }
    if (k.hero) {
      // Bomber con schiena rossa e profilo chiaro: leggibile anche nella folla.
      g.fillStyle = '#b8342c';
      g.beginPath();
      g.ellipse(cx - 1.6, cy, 5.2, 5.4, 0, 1.6, 4.7);
      g.fill();
      g.strokeStyle = 'rgba(236,240,246,0.85)';
      g.lineWidth = 1.1;
      g.beginPath();
      g.ellipse(cx, cy, 7.6, 6.2, 0, 0, 6.2832);
      g.stroke();
      // Colletto alzato
      g.fillStyle = '#3a3f46';
      roundRect(g, cx + 1.4, cy - 4.6, 3.4, 9.2, 1.6);
      g.fill();
    }
  });
}

// ---------------------------------------------------------------------------
// ARREDO URBANO
// ---------------------------------------------------------------------------
export function getPropSprite(p) {
  const t = p.type;
  const key = `prop:${t}:${p.tint || 0}:${p.word || ''}`;
  switch (t) {
    case 'lamp':
      return sprite(key, 30, 12, (g, w, h) => {
        g.fillStyle = '#3c4149';
        g.beginPath(); g.arc(4, h / 2, 3.4, 0, 6.2832); g.fill();
        g.strokeStyle = '#4a5058'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(4, h / 2); g.lineTo(22, h / 2); g.stroke();
        g.fillStyle = '#d8dce2';
        roundRect(g, 21, h / 2 - 3, 8, 6, 2.5); g.fill();
      });
    case 'tree': {
      const tints = [['#3f6b3a', '#2c4f2a'], ['#4a7340', '#33562d'], ['#587a3c', '#3d5a2b']];
      const [c1, c2] = tints[(p.tint || 0) % 3];
      return sprite(key, 40, 40, (g, w, h) => {
        const cx = w / 2, cy = h / 2;
        g.fillStyle = '#4a3a2a';
        g.beginPath(); g.arc(cx, cy, 4, 0, 6.2832); g.fill();
        const blobs = [[-5, -4, 11], [6, -3, 10], [0, 6, 10], [-6, 5, 8], [5, 6, 8]];
        for (const [dx, dy, r] of blobs) {
          const gr = g.createRadialGradient(cx + dx - r * 0.3, cy + dy - r * 0.35, 1, cx + dx, cy + dy, r);
          gr.addColorStop(0, c1);
          gr.addColorStop(1, c2);
          g.fillStyle = gr;
          g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, 6.2832); g.fill();
        }
      });
    }
    case 'bin':
      return sprite(key, 20, 20, (g, w, h) => {
        g.fillStyle = '#3b4a3f';
        roundRect(g, 2, 2, w - 4, h - 4, 3); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.1)';
        roundRect(g, 4, 4, w - 8, h - 8, 2); g.fill();
      });
    case 'hydrant':
      return sprite(key, 14, 14, (g, w, h) => {
        g.fillStyle = '#b03a2e';
        g.beginPath(); g.arc(w / 2, h / 2, 4.6, 0, 6.2832); g.fill();
        g.fillStyle = '#d9564a';
        g.beginPath(); g.arc(w / 2 - 1, h / 2 - 1, 3, 0, 6.2832); g.fill();
      });
    case 'bench':
      return sprite(key, 40, 16, (g, w, h) => {
        g.fillStyle = '#6b5138';
        roundRect(g, 2, 3, w - 4, h - 6, 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
        for (let x = 5; x < w - 4; x += 6) { g.beginPath(); g.moveTo(x, 4); g.lineTo(x, h - 4); g.stroke(); }
      });
    case 'vending':
      return sprite(key, 26, 20, (g, w, h) => {
        g.fillStyle = '#2f3b52';
        roundRect(g, 2, 2, w - 4, h - 4, 2); g.fill();
        g.fillStyle = '#e05a6a';
        g.fillRect(4, 4, w - 8, 5);
        g.fillStyle = '#8fd2e8';
        g.fillRect(4, 11, w - 8, h - 15);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        for (let i = 0; i < 4; i++) g.fillRect(6 + i * 4.6, 12, 3, h - 17);
      });
    case 'kiosk':
      return sprite(key, 52, 34, (g, w, h) => {
        g.fillStyle = '#c25a3a';
        roundRect(g, 2, 2, w - 4, h - 4, 3); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.25)';
        roundRect(g, 5, 5, w - 10, h - 10, 2); g.fill();
        g.fillStyle = p.accent || '#ffcf4a';
        g.fillRect(6, 6, w - 12, 7);
        if (p.word) {
          g.fillStyle = '#1b1b1e';
          g.font = 'bold 7px system-ui, sans-serif';
          g.textAlign = 'center';
          g.fillText(p.word, w / 2, 12);
        }
        g.fillStyle = 'rgba(255,240,200,0.25)';
        g.fillRect(6, 16, w - 12, h - 22);
      });
    case 'busstop':
      return sprite(key, 54, 22, (g, w, h) => {
        g.fillStyle = 'rgba(180,200,220,0.35)';
        roundRect(g, 2, 2, w - 4, h - 4, 2); g.fill();
        g.strokeStyle = '#8a9099'; g.lineWidth = 2; g.stroke();
        g.fillStyle = '#2f6fb5';
        g.fillRect(4, 4, w - 8, 4);
      });
    case 'pallet':
      return sprite(key, 26, 22, (g, w, h) => {
        g.fillStyle = '#8a6a42';
        g.fillRect(2, 2, w - 4, h - 4);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        for (let y = 4; y < h - 4; y += 5) g.fillRect(3, y, w - 6, 2);
      });
    case 'ac_unit':
      return sprite(key, 24, 22, (g, w, h) => {
        g.fillStyle = '#8d939b';
        roundRect(g, 2, 2, w - 4, h - 4, 2); g.fill();
        g.strokeStyle = '#5d636b'; g.lineWidth = 1.2; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.arc(w / 2, h / 2, 6, 0, 6.2832); g.stroke();
        for (let a = 0; a < 6.28; a += 1.05) {
          g.beginPath(); g.moveTo(w / 2, h / 2);
          g.lineTo(w / 2 + Math.cos(a) * 6, h / 2 + Math.sin(a) * 6); g.stroke();
        }
      });
    case 'barrier':
      return sprite(key, 30, 14, (g, w, h) => {
        g.fillStyle = '#d9542f';
        roundRect(g, 2, 3, w - 4, h - 6, 2); g.fill();
        g.fillStyle = '#e8e4dc';
        for (let x = 4; x < w - 4; x += 8) g.fillRect(x, 4, 4, h - 8);
      });
    case 'tank':
      return sprite(key, p.r * 2 + 6, p.r * 2 + 6, (g, w, h) => {
        const gr = g.createRadialGradient(w * 0.35, h * 0.35, 2, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#9aa2a8');
        gr.addColorStop(1, '#5d666c');
        g.fillStyle = gr;
        g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, 6.2832); g.fill();
        g.strokeStyle = '#41484d'; g.lineWidth = 2; g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.25)';
        g.beginPath(); g.arc(w / 2, h / 2, w * 0.28, 0, 6.2832); g.stroke();
      });
    case 'crane':
      return sprite(key, 190, 46, (g, w, h) => {
        g.fillStyle = '#b58a2f';
        roundRect(g, 2, h / 2 - 7, w - 4, 14, 3); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.4;
        for (let x = 8; x < w - 8; x += 14) {
          g.beginPath(); g.moveTo(x, h / 2 - 7); g.lineTo(x + 10, h / 2 + 7); g.stroke();
          g.beginPath(); g.moveTo(x + 10, h / 2 - 7); g.lineTo(x, h / 2 + 7); g.stroke();
        }
        g.fillStyle = '#4a4f55';
        roundRect(g, w * 0.36, 2, w * 0.16, h - 4, 3); g.fill();
        g.fillStyle = '#d9d24a';
        roundRect(g, w * 0.38, 6, w * 0.12, h - 12, 2); g.fill();
      });
    case 'traffic_light':
      return sprite(key, 22, 12, (g, w, h) => {
        g.fillStyle = '#31353b';
        roundRect(g, 2, h / 2 - 4, w - 4, 8, 2); g.fill();
      });
    default:
      return sprite(`prop:unknown`, 12, 12, (g, w, h) => {
        g.fillStyle = '#888';
        g.fillRect(1, 1, w - 2, h - 2);
      });
  }
}

// ---------------------------------------------------------------------------
// RACCOLTE A TERRA
// ---------------------------------------------------------------------------
/** Sagoma di un'arma, usata sia nella cassa a terra sia in mano al personaggio. */
function drawGun(g, w, h, kind) {
  g.fillStyle = '#1a1c20';
  if (kind === 'smg') {
    roundRect(g, w * 0.1, h * 0.42, w * 0.66, h * 0.17, 1.5); g.fill();
    roundRect(g, w * 0.3, h * 0.55, w * 0.12, h * 0.3, 1.5); g.fill();
    roundRect(g, w * 0.62, h * 0.3, w * 0.1, h * 0.14, 1); g.fill();
  } else if (kind === 'bat') {
    g.strokeStyle = '#8a6a42';
    g.lineWidth = Math.max(2, h * 0.12);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.14, h * 0.6);
    g.lineTo(w * 0.82, h * 0.4);
    g.stroke();
    g.lineWidth = Math.max(3, h * 0.2);
    g.beginPath();
    g.moveTo(w * 0.56, h * 0.46);
    g.lineTo(w * 0.84, h * 0.4);
    g.stroke();
  } else {
    roundRect(g, w * 0.22, h * 0.42, w * 0.5, h * 0.15, 1.5); g.fill();
    roundRect(g, w * 0.3, h * 0.54, w * 0.13, h * 0.26, 1.5); g.fill();
  }
}

export function getPickupSprite(kind) {
  return sprite(`pick:${kind}`, 30, 26, (g, w, h) => {
    if (kind === 'health') {
      g.fillStyle = '#e8ecf0';
      roundRect(g, 4, 5, w - 8, h - 10, 3); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#c62f34';
      g.fillRect(w / 2 - 2, 9, 4, h - 18);
      g.fillRect(w / 2 - 7, h / 2 - 2, 14, 4);
      return;
    }
    if (kind === 'ammo') {
      g.fillStyle = '#3f4a35';
      roundRect(g, 3, 5, w - 6, h - 10, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.stroke();
      g.fillStyle = '#c9a24a';
      for (let i = 0; i < 4; i++) g.fillRect(6 + i * 5, 9, 3, h - 18);
      return;
    }
    // Borsone con l'arma sopra.
    g.fillStyle = '#2b2f36';
    roundRect(g, 2, 8, w - 4, h - 12, 4); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.09)';
    roundRect(g, 4, 10, w - 8, 5, 2); g.fill();
    drawGun(g, w, h, kind);
  });
}

/** Canvas di rumore riusabile per l'asfalto (il pattern va creato dal ctx chiamante). */
let noiseCv = null;
export function noiseCanvas() {
  if (noiseCv) return noiseCv;
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d');
  const img = g.createImageData(96, 96);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 14;
  }
  g.putImageData(img, 0, 0);
  noiseCv = c;
  return noiseCv;
}

/** Pre-genera gli sprite più usati per evitare scatti al primo incontro. */
export function preloadSprites() {
  for (const kind of Object.keys(VEHICLE_TYPES)) {
    for (let c = 0; c < 4; c++) getVehicleSprite(kind, c);
    getWreckSprite(kind);
  }
  for (const kind of Object.keys(PED_KINDS)) {
    for (let c = 0; c < 3; c++) {
      for (let f = 0; f < PED_FRAMES; f++) getPedSprite(kind, c, f);
    }
  }
  for (const type of ['lamp', 'tree', 'bin', 'hydrant', 'bench', 'vending', 'busstop', 'pallet', 'ac_unit', 'barrier']) {
    getPropSprite({ type, tint: 0, r: 12 });
  }
}
