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
  tractor: { len: 80, wid: 40, mass: 1.9,  topSpeed: 135, accel: 105, grip: 0.84, hp: 190, cabin: [0.24, 0.6], label: 'trattore' },

  // Velivoli. `air` è il tipo di sostentamento: 'rotor' sale da fermo, 'wing'
  // pretende di aver preso velocità sulla pista (`rotate`). `ceiling` è la quota
  // massima, `climb` quanti px/s si guadagnano tenendo premuto.
  heli:    {
    len: 100, wid: 34, mass: 1.7, topSpeed: 460, accel: 190, grip: 1.5, hp: 210,
    cabin: [0.46, 0.9], label: 'elicottero', air: 'rotor', climb: 130, ceiling: 400, rotor: 56,
  },
  plane:   {
    len: 132, wid: 96, mass: 2.1, topSpeed: 620, accel: 175, grip: 2.4, hp: 190,
    cabin: [0.5, 0.86], label: 'turboelica', air: 'wing', climb: 105, ceiling: 460, rotate: 250,
  },
  // Imbarcazioni. `marine` significa: galleggia, l'asfalto la ferma come un muro,
  // e il grip laterale bassissimo è quello che fa scarrocciare la poppa in virata.
  boat:    { len: 90, wid: 30, mass: 1.0, topSpeed: 400, accel: 165, grip: 0.34, hp: 130, cabin: [0.24, 0.6], label: 'motoscafo', marine: true },
  ferry:   { len: 154, wid: 54, mass: 3.4, topSpeed: 215, accel: 82, grip: 0.26, hp: 340, cabin: [0.34, 0.68], label: 'battello', marine: true },
  // Motovedetta della polizia. Più lenta del motoscafo civile ma più robusta: in
  // acqua non ci sono vicoli in cui infilarsi, e se ti raggiungesse in dieci
  // secondi la fuga in barca smetterebbe di essere una fuga.
  patrol:  { len: 104, wid: 34, mass: 1.4, topSpeed: 355, accel: 150, grip: 0.33, hp: 190, cabin: [0.24, 0.62], label: 'motovedetta', marine: true },
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

/**
 * Motovedetta: stessa livrea bianca e blu delle volanti, perché è la livrea a dire
 * "polizia" in una visuale dall'alto — lo scafo da solo si legge come un motoscafo
 * qualunque. La banda blu corre lungo la murata, non attorno al tetto come in auto:
 * su una barca il ponte è quasi tutto scafo.
 */
function drawPatrolExtras(g, w, h) {
  g.fillStyle = '#1c3f8f';
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.16);
  g.lineTo(w * 0.7, h * 0.08);
  g.lineTo(w * 0.7, h * 0.17);
  g.lineTo(w * 0.1, h * 0.25);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(w * 0.1, h * 0.84);
  g.lineTo(w * 0.7, h * 0.92);
  g.lineTo(w * 0.7, h * 0.83);
  g.lineTo(w * 0.1, h * 0.75);
  g.closePath();
  g.fill();
  // Sigla sul pozzetto: piccola, ma è quello che a schermo fermo distingue la
  // motovedetta da un motoscafo bianco qualunque.
  g.fillStyle = 'rgba(28,63,143,0.95)';
  g.font = 'bold 8px sans-serif';
  g.textAlign = 'center';
  g.fillText('경비정', w * 0.28, h * 0.57);
  // Faro lampeggiante sulla tuga (i colori vivi li aggiunge il renderer).
  g.fillStyle = '#2a2d33';
  roundRect(g, w * 0.46, h * 0.38, w * 0.07, h * 0.24, 2); g.fill();
  g.fillStyle = '#7a1f22';
  g.fillRect(w * 0.47, h * 0.4, w * 0.05, h * 0.09);
  g.fillStyle = '#1b3a7a';
  g.fillRect(w * 0.47, h * 0.51, w * 0.05, h * 0.09);
}

/** Trattore: ruote posteriori enormi, cabina arretrata, muso stretto col motore. */
function drawTractor(g, w, h, color) {
  // Ruote posteriori enormi e sporgenti: da sopra sono la firma del trattore.
  g.fillStyle = '#1b1e22';
  roundRect(g, w * 0.06, -4, w * 0.3, h + 8, 5); g.fill();
  roundRect(g, w * 0.74, h * 0.06, w * 0.18, h * 0.88, 4); g.fill();
  g.fillStyle = 'rgba(235,240,248,0.16)';                          // tasselli
  for (let y = -3; y < h + 4; y += 7) g.fillRect(w * 0.07, y, w * 0.28, 3);
  for (let y = h * 0.08; y < h * 0.92; y += 6) g.fillRect(w * 0.75, y, w * 0.16, 2.4);

  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.3));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shade(color, -0.34));
  g.fillStyle = grad;
  roundRect(g, w * 0.3, h * 0.24, w * 0.56, h * 0.52, 4); g.fill(); // cofano
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = shade(color, -0.18);
  roundRect(g, w * 0.06, h * 0.12, w * 0.28, h * 0.76, 4); g.fill(); // cabina
  g.fillStyle = GLASS_DARK;
  roundRect(g, w * 0.11, h * 0.2, w * 0.18, h * 0.6, 3); g.fill();
  g.fillStyle = '#2a2d31';                                          // marmitta
  roundRect(g, w * 0.62, h * 0.06, w * 0.06, h * 0.16, 2); g.fill();
  g.fillStyle = '#ffeec2';
  roundRect(g, w * 0.86, h * 0.28, 4, h * 0.13, 1.4); g.fill();
  roundRect(g, w * 0.86, h * 0.59, 4, h * 0.13, 1.4); g.fill();
}

/**
 * Elicottero visto da sopra: fuso a goccia, trave di coda, pattini. Le pale non
 * stanno qui — le disegna la scena, perché devono girare.
 */
function drawHeli(g, w, h, color) {
  // Pattini: due barre che sporgono, ed è quello che lo fa leggere come posato
  // e non come una macchia.
  g.strokeStyle = '#22262c';
  g.lineWidth = 3;
  for (const s of [-1, 1]) {
    const y = h / 2 + s * h * 0.4;
    g.beginPath(); g.moveTo(w * 0.3, y); g.lineTo(w * 0.72, y); g.stroke();
  }
  // Trave di coda
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.28));
  grad.addColorStop(0.55, color);
  grad.addColorStop(1, shade(color, -0.32));
  g.fillStyle = grad;
  roundRect(g, w * 0.06, h * 0.4, w * 0.5, h * 0.2, 4); g.fill();
  // Deriva verticale e stabilizzatore
  g.fillStyle = shade(color, -0.2);
  roundRect(g, w * 0.03, h * 0.18, w * 0.09, h * 0.64, 3); g.fill();
  // Fusoliera a goccia
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.94, h * 0.5);
  g.bezierCurveTo(w * 0.9, h * 0.06, w * 0.52, h * 0.1, w * 0.44, h * 0.36);
  g.lineTo(w * 0.44, h * 0.64);
  g.bezierCurveTo(w * 0.52, h * 0.9, w * 0.9, h * 0.94, w * 0.94, h * 0.5);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.5; g.stroke();
  // Vetratura frontale
  const gg = g.createLinearGradient(w * 0.7, 0, w, h);
  gg.addColorStop(0, '#31404e');
  gg.addColorStop(1, GLASS_DARK);
  g.fillStyle = gg;
  g.beginPath();
  g.ellipse(w * 0.79, h * 0.5, w * 0.13, h * 0.3, 0, 0, 6.2832);
  g.fill();
  // Mozzo del rotore
  g.fillStyle = '#3a4049';
  g.beginPath(); g.arc(w * 0.62, h * 0.5, 5.5, 0, 6.2832); g.fill();
  g.fillStyle = '#20242a';
  g.beginPath(); g.arc(w * 0.62, h * 0.5, 2.4, 0, 6.2832); g.fill();
}

/** Turboelica leggero: ala centrale, piani di coda, disco dell'elica sul muso. */
function drawPlane(g, w, h, color) {
  const cy = h / 2;
  // Ala: è la parte che dice "aereo" prima di ogni altra cosa.
  const wg = g.createLinearGradient(0, 0, 0, h);
  wg.addColorStop(0, shade(color, 0.24));
  wg.addColorStop(0.5, shade(color, 0.04));
  wg.addColorStop(1, shade(color, -0.3));
  g.fillStyle = wg;
  const cy0 = h / 2;
  for (const s of [-1, 1]) {
    // Semiala rastremata e con un filo di freccia: un rettangolo pieno da sopra
    // si legge come una crocera, non come un'ala.
    g.beginPath();
    g.moveTo(w * 0.44, cy0 + s * h * 0.04);
    g.lineTo(w * 0.53, cy0 + s * h * 0.48);
    g.lineTo(w * 0.61, cy0 + s * h * 0.48);
    g.lineTo(w * 0.66, cy0 + s * h * 0.04);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.2; g.stroke();
  }
  // Gondole motore sotto l'ala, con il loro disco d'elica
  for (const s of [-1, 1]) {
    g.fillStyle = '#3d434b';
    roundRect(g, w * 0.6, cy + s * h * 0.28 - h * 0.04, w * 0.19, h * 0.08, 3); g.fill();
    g.strokeStyle = 'rgba(200,210,225,0.3)';
    g.lineWidth = 1.6;
    g.beginPath(); g.ellipse(w * 0.8, cy + s * h * 0.28, w * 0.015, h * 0.1, 0, 0, 6.2832); g.stroke();
  }
  // Piani di coda: piccoli, o rubano la scena all'ala
  g.fillStyle = wg;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(w * 0.06, cy + s * h * 0.03);
    g.lineTo(w * 0.12, cy + s * h * 0.26);
    g.lineTo(w * 0.18, cy + s * h * 0.26);
    g.lineTo(w * 0.2, cy + s * h * 0.03);
    g.closePath();
    g.fill();
  }
  // Fusoliera
  g.fillStyle = wg;
  g.beginPath();
  g.moveTo(w * 0.93, cy);
  g.bezierCurveTo(w * 0.88, cy - h * 0.1, w * 0.4, cy - h * 0.085, w * 0.04, cy - h * 0.035);
  g.lineTo(w * 0.04, cy + h * 0.035);
  g.bezierCurveTo(w * 0.4, cy + h * 0.085, w * 0.88, cy + h * 0.1, w * 0.93, cy);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.stroke();
  // Cabina
  const gg = g.createLinearGradient(w * 0.72, 0, w * 0.92, h);
  gg.addColorStop(0, '#33414f');
  gg.addColorStop(1, GLASS_DARK);
  g.fillStyle = gg;
  g.beginPath();
  g.ellipse(w * 0.8, cy, w * 0.08, h * 0.055, 0, 0, 6.2832);
  g.fill();
  // Disco dell'elica: un anello traslucido, non tre bastoncini
  g.strokeStyle = 'rgba(200,210,225,0.35)';
  g.lineWidth = 2;
  g.beginPath(); g.ellipse(w * 0.95, cy, w * 0.02, h * 0.2, 0, 0, 6.2832); g.stroke();
  // Bande di livrea lungo la fusoliera
  g.fillStyle = 'rgba(255,255,255,0.5)';
  g.fillRect(w * 0.12, cy - 1.5, w * 0.6, 3);
}

/** Scafo planante: prua a punta, parabrezza inclinato, scia di poppa. */
function drawBoatHull(g, w, h, color, big) {
  const cy = h / 2;
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, shade(color, 0.3));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, shade(color, -0.34));
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.99, cy);                          // prua
  g.bezierCurveTo(w * 0.8, 1, w * 0.4, 1.5, w * 0.04, h * 0.14);
  g.lineTo(w * 0.04, h * 0.86);                    // specchio di poppa
  g.bezierCurveTo(w * 0.4, h - 1.5, w * 0.8, h - 1, w * 0.99, cy);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.6; g.stroke();
  // Pozzetto
  g.fillStyle = shade(color, -0.22);
  roundRect(g, w * 0.12, h * 0.2, w * (big ? 0.44 : 0.36), h * 0.6, 5); g.fill();
  // Tuga e parabrezza
  const gg = g.createLinearGradient(0, 0, 0, h);
  gg.addColorStop(0, '#33414f');
  gg.addColorStop(1, GLASS_DARK);
  g.fillStyle = gg;
  roundRect(g, w * (big ? 0.56 : 0.5), h * 0.26, w * 0.12, h * 0.48, 3); g.fill();
  // Coperta chiara di prua: senza, da sopra la barca è una macchia sola
  g.fillStyle = 'rgba(240,244,248,0.5)';
  g.beginPath();
  g.moveTo(w * 0.97, cy);
  g.bezierCurveTo(w * 0.86, h * 0.2, w * 0.78, h * 0.24, w * 0.72, h * 0.3);
  g.lineTo(w * 0.72, h * 0.7);
  g.bezierCurveTo(w * 0.78, h * 0.76, w * 0.86, h * 0.8, w * 0.97, cy);
  g.closePath();
  g.fill();
  if (big) {
    // Battello: fascia di finestrini e boma di carico
    g.fillStyle = '#1b232c';
    g.fillRect(w * 0.16, h * 0.26, w * 0.36, h * 0.08);
    g.fillRect(w * 0.16, h * 0.66, w * 0.36, h * 0.08);
    g.fillStyle = '#3d434b';
    roundRect(g, w * 0.2, h * 0.44, w * 0.3, h * 0.12, 3); g.fill();
  }
  // Fanali di via: rosso a sinistra, verde a dritta
  g.fillStyle = '#c33a33';
  g.beginPath(); g.arc(w * 0.86, h * 0.24, 2.2, 0, 6.2832); g.fill();
  g.fillStyle = '#3fbf6a';
  g.beginPath(); g.arc(w * 0.86, h * 0.76, 2.2, 0, 6.2832); g.fill();
}

export function getVehicleSprite(kind, colorIndex = 0) {
  const spec = VEHICLE_TYPES[kind] || VEHICLE_TYPES.sedan;
  let color = VEHICLE_COLORS[colorIndex % VEHICLE_COLORS.length];
  if (kind === 'taxi') color = ['#d98f2b', '#c3c8cf', '#2f5f9e'][colorIndex % 3];
  if (kind === 'bus') color = ['#2f6fb5', '#3f8f5a', '#c9a13c'][colorIndex % 3];
  if (kind === 'police') color = '#e8ecf2';
  if (kind === 'swat') color = '#2b3138';
  if (kind === 'truck') color = ['#7b8288', '#4a5560', '#8f6a42'][colorIndex % 3];
  if (kind === 'tractor') color = ['#3f7a3a', '#b5502a', '#c9a13c'][colorIndex % 3];
  if (kind === 'heli') color = ['#2f3b48', '#8a2f2f', '#3f5a3a'][colorIndex % 3];
  if (kind === 'plane') color = ['#dfe4ea', '#c8ccd2', '#9fb3c8'][colorIndex % 3];
  if (kind === 'boat') color = ['#e8ecf0', '#2f5f9e', '#c9d0d8'][colorIndex % 3];
  if (kind === 'ferry') color = ['#4a6a86', '#5c6660', '#8a7a5a'][colorIndex % 3];
  if (kind === 'patrol') color = '#e8ecf2';

  const key = `veh:${kind}:${colorIndex}`;
  const pad = 4;
  return sprite(key, spec.len + pad, spec.wid + pad * 1.6, (g, w, h) => {
    g.translate(pad / 2, pad * 0.8);
    const iw = spec.len;
    const ih = spec.wid;
    if (kind === 'bus') drawBus(g, iw, ih, color);
    else if (kind === 'scooter') drawScooter(g, iw, ih, color);
    else if (kind === 'tractor') drawTractor(g, iw, ih, color);
    else if (kind === 'heli') drawHeli(g, iw, ih, color);
    else if (kind === 'plane') drawPlane(g, iw, ih, color);
    else if (spec.marine) {
      drawBoatHull(g, iw, ih, color, kind === 'ferry');
      if (kind === 'patrol') drawPatrolExtras(g, iw, ih);
    }
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
  // Divisa: berretto blu e bretelle catarifrangenti. Dall'alto un poliziotto e un
  // teppista sono due macchie scure identiche: senza questi due segni non si
  // capisce chi ti sta sparando.
  cop:      { coats: ['#243a63', '#1f3357'], pants: '#1b2436', hair: '#171717', speed: 56, bag: 0.1, hp: 75, fights: true, police: '#16233c', vest: 'rgba(232,226,160,0.9)' },
  swat:     { coats: ['#252a33'], pants: '#191d24', hair: '#141414', speed: 52, bag: 0.1, hp: 135, fights: true, police: '#0f1216', vest: 'rgba(120,132,148,0.9)', armor: true },
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
    if (k.vest) {
      // Bretelle catarifrangenti sul torso (o piastra antiproiettile per la SWAT).
      if (k.armor) {
        g.fillStyle = k.vest;
        roundRect(g, cx - 4.4, cy - 4.6, 8.4, 9.2, 2.4); g.fill();
      } else {
        g.strokeStyle = k.vest;
        g.lineWidth = 1.5;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx - 5.6, cy + s * 3.6);
          g.lineTo(cx + 3.6, cy + s * 2.2);
          g.stroke();
        }
      }
    }
    if (k.police) {
      // Berretto con visiera e distintivo dorato.
      g.fillStyle = k.police;
      g.beginPath(); g.arc(cx + 2, cy, 5.4, 0, 6.2832); g.fill();
      g.fillStyle = shade(k.police, 0.18);
      roundRect(g, cx + 5.8, cy - 3.2, 2.8, 6.4, 1.2); g.fill();
      g.fillStyle = k.armor ? '#8d97a4' : '#d9b455';
      g.fillRect(cx + 3.2, cy - 1, 1.8, 2);
    }
  });
}

// ---------------------------------------------------------------------------
// JAE-MIN SEO — il protagonista
// ---------------------------------------------------------------------------
// Dall'alto un personaggio è una macchia scura larga venti pixel: per riconoscerlo
// nella folla non serve dettaglio, serve **silhouette**. Tre segni fanno tutto il
// lavoro, e sono gli stessi che si leggono sulla minimappa e nel ritratto dell'HUD:
// la fascia rossa con le code che svolazzano, le strisce della tigre bianca
// (백호, la gang del padre) sulla schiena del bomber, e le spalle più larghe di
// chiunque altro in strada.
const HERO = {
  jacket: '#242935',
  red: '#c62f2a',
  bone: '#ece7da',
  jeans: '#242833',
  hair: '#16120f',
  skin: '#d6a883',
};

/**
 * Guardaroba. Cambia solo il bomber: fascia rossa, tigre e silhouette restano, o
 * il giocatore smetterebbe di riconoscersi nella folla. È quello che si compra al
 * 옷가게 per togliersi una stella di dosso.
 */
export const HERO_OUTFITS = [
  { id: 'baekho', label: 'bomber nero', jacket: '#242935' },
  { id: 'track', label: 'tuta blu', jacket: '#27466f' },
  { id: 'work', label: 'giacca da lavoro', jacket: '#5a5343' },
  { id: 'club', label: 'giacca da club', jacket: '#5c2740' },
  { id: 'suit', label: 'completo grigio', jacket: '#4a4d55' },
];

/**
 * Sprite del protagonista. `pose` vale 'walk' o 'aim': con un'arma da fuoco in
 * pugno le braccia si tendono in avanti, ed è quello che rende leggibile a schermo
 * la differenza fra camminare e stare puntando qualcuno. `outfit` è il bomber
 * comprato al negozio di vestiti — entra nella chiave di cache, non nel disegno.
 */
export function getHeroSprite(frame = 0, pose = 'walk', outfit = 0) {
  const W = 40, H = 34;
  const jacket = (HERO_OUTFITS[outfit] || HERO_OUTFITS[0]).jacket;
  return sprite(`hero:${pose}:${frame}:${outfit}`, W, H, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    const ph = Math.sin((frame / PED_FRAMES) * Math.PI * 2);
    const aiming = pose === 'aim';

    // 1) Gambe. Dall'alto il tronco le copre quasi tutte: quello che si deve
    // vedere è il piede che sbuca di lato a ogni passo, non la gamba intera.
    for (const s of [-1, 1]) {
      const sw = s * ph * 3.2;
      const y = s > 0 ? cy + 4.6 : cy - 9.4;
      g.fillStyle = HERO.jeans;
      roundRect(g, cx - 7.5 + sw, y, 9.5, 4.8, 2.2); g.fill();
      g.fillStyle = HERO.red; // suola rossa: si legge anche in movimento
      roundRect(g, cx + 0.4 + sw, y + 0.4, 1.7, 4, 0.8); g.fill();
    }

    // 2) Braccia, fuori dalla sagoma delle spalle. Da fermo oscillano, in mira
    // convergono sull'arma: è la differenza che si legge da lontano.
    g.strokeStyle = shade(jacket, 0.08);
    g.lineWidth = 3.2;
    if (aiming) {
      g.beginPath(); g.moveTo(cx + 0.6, cy + 6.6); g.lineTo(cx + 8.6, cy + 4); g.stroke();
      g.beginPath(); g.moveTo(cx + 0.6, cy - 6.6); g.lineTo(cx + 7.4, cy + 1.4); g.stroke();
    } else {
      g.beginPath(); g.moveTo(cx + 0.6, cy + 6.6); g.lineTo(cx - 2.8 + ph * 3.6, cy + 8.8); g.stroke();
      g.beginPath(); g.moveTo(cx + 0.6, cy - 6.6); g.lineTo(cx - 2.8 - ph * 3.6, cy - 8.8); g.stroke();
    }

    // 3) Tronco: non un'ellisse ma un trapezio arrotondato — spalle larghe davanti,
    // vita stretta dietro. È la forma che dice "persona, e guarda da quella parte".
    const torso = () => {
      g.beginPath();
      g.moveTo(cx + 4.6, cy - 6.2);
      g.quadraticCurveTo(cx + 2.2, cy - 8.4, cx - 1, cy - 7.6);
      g.lineTo(cx - 6.4, cy - 5.4);
      g.quadraticCurveTo(cx - 9.6, cy, cx - 6.4, cy + 5.4);
      g.lineTo(cx - 1, cy + 7.6);
      g.quadraticCurveTo(cx + 2.2, cy + 8.4, cx + 4.6, cy + 6.2);
      g.quadraticCurveTo(cx + 7.6, cy, cx + 4.6, cy - 6.2);
      g.closePath();
    };
    const grad = g.createLinearGradient(cx, cy - 9, cx, cy + 9);
    grad.addColorStop(0, shade(jacket, 0.36));
    grad.addColorStop(0.5, jacket);
    grad.addColorStop(1, shade(jacket, -0.5));
    g.fillStyle = grad;
    torso(); g.fill();

    // 4) Banda rossa lungo la spina dorsale — che è anche una freccia: dice da che
    // parte guarda — e sopra, l'artigliata bianca della tigre (백호).
    g.save();
    torso(); g.clip();
    g.fillStyle = HERO.red;
    g.fillRect(cx - 10, cy - 1.6, 16, 3.2);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(cx - 10, cy + 0.7, 16, 0.9);
    g.strokeStyle = 'rgba(240,236,224,0.9)';
    g.lineWidth = 0.9;
    for (const dx of [-7.4, -6, -4.6]) {
      g.beginPath();
      g.moveTo(cx + dx, cy - 2.8);
      g.lineTo(cx + dx + 1.2, cy + 2.8);
      g.stroke();
    }
    g.restore();

    g.strokeStyle = 'rgba(0,0,0,0.62)';
    g.lineWidth = 1.4;
    torso(); g.stroke();

    // 5) Code della fascia: corte, dietro la nuca. Bastano a dare movimento senza
    // trasformarsi in due antenne rosse lunghe quanto il personaggio.
    g.strokeStyle = HERO.red;
    g.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx + 2.4, cy + s * 2.2);
      g.quadraticCurveTo(cx - 0.6, cy + s * 4 + ph, cx - 3.4, cy + s * 4.6 + ph * 2.2);
      g.stroke();
    }

    // 6) Testa: piccola e spostata avanti, così le spalle restano leggibili dietro.
    const hx = cx + 3.6;
    const hr = 4.3;
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.arc(hx - 0.6, cy + 0.8, hr + 0.5, 0, 6.2832); g.fill();
    const hg = g.createRadialGradient(hx + 1.4, cy - 1.6, 0.5, hx, cy, hr + 0.8);
    hg.addColorStop(0, shade(HERO.hair, 0.45));
    hg.addColorStop(1, HERO.hair);
    g.fillStyle = hg;
    g.beginPath(); g.arc(hx, cy, hr, 0, 6.2832); g.fill();
    // Rasatura ai lati
    g.strokeStyle = 'rgba(120,104,88,0.55)';
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(hx, cy, hr - 0.7, 1.1, 2.2); g.stroke();
    g.beginPath(); g.arc(hx, cy, hr - 0.7, -2.2, -1.1); g.stroke();
    // Ciuffo decolorato
    g.fillStyle = '#dbd1b0';
    g.beginPath();
    g.moveTo(hx - 0.4, cy - 4);
    g.quadraticCurveTo(hx + 4.2, cy - 2.6, hx + 3.4, cy - 0.3);
    g.quadraticCurveTo(hx + 1.8, cy - 2.2, hx - 0.8, cy - 3);
    g.closePath(); g.fill();
    // Fascia rossa in fronte
    g.save();
    g.beginPath(); g.arc(hx, cy, hr, 0, 6.2832); g.clip();
    g.fillStyle = HERO.red;
    g.fillRect(hx + 0.5, cy - 5, 1.9, 10);
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.fillRect(hx + 0.5, cy - 5, 0.6, 10);
    g.restore();
    // Filo di luce sul cranio: senza, la testa nera sparisce dentro il bomber nero.
    g.strokeStyle = 'rgba(230,236,244,0.42)';
    g.lineWidth = 0.9;
    g.beginPath(); g.arc(hx, cy, hr - 0.3, 3.5, 5.4); g.stroke();
    // Viso verso la direzione di marcia
    g.fillStyle = HERO.skin;
    g.beginPath(); g.arc(hx + 1.9, cy, 2.3, -1.2, 1.2); g.fill();
    g.fillStyle = 'rgba(20,16,14,0.5)';
    g.fillRect(hx + 2.9, cy - 1.7, 1.2, 0.7);
    g.fillRect(hx + 2.9, cy + 1, 1.2, 0.7);

    // 7) Filo di luce sul bordo verso il sole: stacca la sagoma dall'asfalto.
    g.strokeStyle = 'rgba(238,242,248,0.42)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx - 6.4, cy - 5.4);
    g.quadraticCurveTo(cx - 9.6, cy, cx - 6.4, cy + 5.4);
    g.stroke();
  });
}

/** Ritratto frontale per l'HUD: la faccia che il giocatore associa a sé stesso. */
export function getHeroPortrait() {
  return sprite('hero:portrait', 46, 46, (g, w, h) => {
    const cx = w / 2;
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#3a2026');
    bg.addColorStop(1, '#101319');
    g.fillStyle = bg;
    roundRect(g, 0, 0, w, h, 7); g.fill();

    g.save();
    roundRect(g, 0.5, 0.5, w - 1, h - 1, 7);
    g.clip();

    // Spalle e colletto del bomber.
    g.fillStyle = HERO.jacket;
    g.beginPath();
    g.moveTo(cx - 23, h);
    g.quadraticCurveTo(cx, h - 17, cx + 23, h);
    g.closePath(); g.fill();
    g.fillStyle = shade(HERO.skin, -0.24);
    g.fillRect(cx - 4.6, h - 21, 9.2, 9);
    g.fillStyle = HERO.red;
    g.beginPath();
    g.moveTo(cx - 12, h - 5); g.lineTo(cx, h - 13); g.lineTo(cx + 12, h - 5);
    g.lineTo(cx + 9, h); g.lineTo(cx - 9, h);
    g.closePath(); g.fill();

    // Testa: mascella squadrata, luce da sinistra.
    const fg = g.createLinearGradient(cx - 9, 0, cx + 9, 0);
    fg.addColorStop(0, shade(HERO.skin, 0.12));
    fg.addColorStop(1, shade(HERO.skin, -0.28));
    g.fillStyle = fg;
    roundRect(g, cx - 8.6, 10, 17.2, 21, 7); g.fill();

    // Capelli: massa alta con rasatura ai lati.
    g.fillStyle = HERO.hair;
    g.beginPath();
    g.moveTo(cx - 9.4, 19);
    g.quadraticCurveTo(cx - 10, 7, cx, 6.2);
    g.quadraticCurveTo(cx + 10, 7, cx + 9.4, 19);
    g.lineTo(cx + 7.4, 15.5);
    g.quadraticCurveTo(cx, 12.4, cx - 7.4, 15.5);
    g.closePath(); g.fill();
    g.fillStyle = '#d9cfae';
    g.beginPath();
    g.moveTo(cx - 1, 6.6);
    g.quadraticCurveTo(cx + 6, 7.6, cx + 6.6, 13.4);
    g.quadraticCurveTo(cx + 2.6, 9.6, cx - 1.6, 8.6);
    g.closePath(); g.fill();

    // Fascia rossa.
    g.fillStyle = HERO.red;
    roundRect(g, cx - 9.6, 14.4, 19.2, 3.6, 1.2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(cx - 9.6, 14.7, 19.2, 1);

    // Occhi, sopracciglia e cicatrice sul sopracciglio destro.
    g.fillStyle = '#14161a';
    g.fillRect(cx - 6.4, 20.4, 4.4, 1.5);
    g.fillRect(cx + 2, 20.4, 4.4, 1.5);
    g.fillStyle = 'rgba(20,22,26,0.75)';
    g.fillRect(cx - 6.8, 18.6, 5, 1.1);
    g.fillRect(cx + 1.8, 18.6, 5, 1.1);
    g.strokeStyle = 'rgba(232,190,170,0.85)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx + 3.4, 16.4);
    g.lineTo(cx + 5.4, 22.4);
    g.stroke();
    // Naso e bocca serrata.
    g.strokeStyle = 'rgba(0,0,0,0.28)';
    g.beginPath(); g.moveTo(cx + 0.4, 21); g.lineTo(cx + 1.4, 25.4); g.stroke();
    g.fillStyle = 'rgba(30,18,18,0.7)';
    g.fillRect(cx - 3.4, 27.4, 7, 1.3);

    g.restore();
    g.strokeStyle = 'rgba(236,240,248,0.22)';
    g.lineWidth = 1.4;
    roundRect(g, 0.7, 0.7, w - 1.4, h - 1.4, 7);
    g.stroke();
  });
}

/**
 * Elicottero della polizia. Il corpo è baked, le pale no: girano a runtime, e una
 * pala ferma su uno sprite in cache si legge come un rottame.
 */
export function getChopperSprite() {
  return sprite('chopper', 96, 40, (g, w, h) => {
    const cy = h / 2;
    // Trave di coda e deriva
    g.fillStyle = '#1b2129';
    roundRect(g, 6, cy - 3.4, 44, 6.8, 3); g.fill();
    g.fillStyle = '#243040';
    roundRect(g, 4, cy - 9, 6, 18, 2); g.fill();
    // Fusoliera
    const grad = g.createLinearGradient(0, cy - 14, 0, cy + 14);
    grad.addColorStop(0, '#3d4a5c');
    grad.addColorStop(0.5, '#232b36');
    grad.addColorStop(1, '#12161c');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(64, cy, 28, 13, 0, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.6; g.stroke();
    // Vetratura del muso
    g.fillStyle = '#0e141c';
    g.beginPath(); g.ellipse(80, cy, 11, 9, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(160,200,240,0.22)';
    g.beginPath(); g.ellipse(82, cy - 2.5, 7, 4.5, 0, 0, 6.2832); g.fill();
    // Pattini
    g.strokeStyle = '#4c545e'; g.lineWidth = 2.4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(50, cy + s * 15);
      g.lineTo(84, cy + s * 15);
      g.stroke();
    }
    // Livrea 경찰
    g.fillStyle = '#1c3f8f';
    g.fillRect(46, cy - 2.4, 34, 4.8);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = 'bold 8px sans-serif';
    g.textAlign = 'center';
    g.fillText('경찰', 62, cy + 2.6);
  });
}

/** Striscia chiodata: il pettine di punte è tutta la sua leggibilità. */
export function getSpikeSprite(horiz) {
  const w = horiz ? 150 : 26;
  const h = horiz ? 26 : 150;
  return sprite(`spikes:${horiz ? 'h' : 'v'}`, w, h, (g) => {
    g.fillStyle = '#1e2126';
    roundRect(g, horiz ? 2 : 8, horiz ? 8 : 2, horiz ? w - 4 : 10, horiz ? 10 : h - 4, 2);
    g.fill();
    // Fasce gialle da attrezzatura di servizio: si legge come roba della polizia
    // e non come una crepa nell'asfalto.
    g.fillStyle = '#d9b32a';
    for (let i = 0; i < (horiz ? w : h); i += 16) {
      if (horiz) g.fillRect(4 + i, 9, 7, 8);
      else g.fillRect(9, 4 + i, 8, 7);
    }
    g.fillStyle = '#c9ccd2';
    const n = Math.floor((horiz ? w : h) / 9);
    for (let i = 0; i < n; i++) {
      const p = 6 + i * 9;
      g.beginPath();
      if (horiz) {
        g.moveTo(p, 8); g.lineTo(p + 3, 1); g.lineTo(p + 6, 8);
        g.moveTo(p, 18); g.lineTo(p + 3, 25); g.lineTo(p + 6, 18);
      } else {
        g.moveTo(8, p); g.lineTo(1, p + 3); g.lineTo(8, p + 6);
        g.moveTo(18, p); g.lineTo(25, p + 3); g.lineTo(18, p + 6);
      }
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
    case 'metro_entrance':
      return sprite(key, 86, 58, (g, w, h) => {
        // Vano della scala: profondo, a gradini, con parapetti azzurri e totem M.
        g.fillStyle = 'rgba(7,13,18,0.92)';
        roundRect(g, 5, 9, w - 18, h - 14, 5); g.fill();
        const stair = g.createLinearGradient(0, 12, 0, h - 7);
        stair.addColorStop(0, '#151c22');
        stair.addColorStop(1, '#6c7983');
        g.fillStyle = stair;
        roundRect(g, 12, 14, w - 34, h - 24, 3); g.fill();
        g.fillStyle = 'rgba(235,242,248,0.26)';
        for (let y = 18; y < h - 11; y += 6) g.fillRect(15, y, w - 40, 2);
        g.strokeStyle = p.accent || '#54d7ff';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(9, 10); g.lineTo(9, h - 6);
        g.moveTo(w - 19, 10); g.lineTo(w - 19, h - 6);
        g.stroke();
        // Totem verticale, leggibile anche quando l'accesso è lontano.
        g.fillStyle = '#176ca1';
        roundRect(g, w - 18, 1, 17, 40, 4); g.fill();
        g.strokeStyle = '#bfefff';
        g.lineWidth = 1.4;
        g.stroke();
        g.fillStyle = '#ffffff';
        g.font = '900 15px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('M', w - 9.5, 18);
        g.font = '800 6px system-ui, sans-serif';
        g.fillText('지하철', w - 9.5, 29);
        g.fillStyle = '#ffd33f';
        g.fillRect(w - 15, 33, 11, 3);
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
    case 'silo':
      return sprite(key, 34, 34, (g, w, h) => {
        const gr = g.createRadialGradient(w * 0.36, h * 0.34, 2, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#c9cdd2');
        gr.addColorStop(1, '#6f757c');
        g.fillStyle = gr;
        g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 6.2832); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.3; g.stroke();
        // Cerchiature: da sopra sono l'unica cosa che distingue un silo da un tank
        g.strokeStyle = 'rgba(0,0,0,0.2)';
        g.beginPath(); g.arc(w / 2, h / 2, w * 0.3, 0, 6.2832); g.stroke();
      });
    case 'windsock':
      return sprite(key, 34, 20, (g, w, h) => {
        g.strokeStyle = '#8a9099'; g.lineWidth = 2.4;
        g.beginPath(); g.moveTo(3, h / 2); g.lineTo(11, h / 2); g.stroke();
        // Manica a strisce: arancio e bianco, come vuole la norma
        const bands = ['#ff7a29', '#f0f2f5', '#ff7a29', '#f0f2f5'];
        for (let i = 0; i < 4; i++) {
          g.fillStyle = bands[i];
          const x = 11 + i * 5.4;
          const hh = h * (0.62 - i * 0.09);
          g.fillRect(x, h / 2 - hh / 2, 5.2, hh);
        }
      });
    case 'bollard':
      return sprite(key, 16, 16, (g, w, h) => {
        g.fillStyle = '#4a4f56';
        g.beginPath(); g.arc(w / 2, h / 2, 6, 0, 6.2832); g.fill();
        g.fillStyle = '#6c727a';
        g.beginPath(); g.arc(w / 2 - 1, h / 2 - 1, 4, 0, 6.2832); g.fill();
      });
    case 'crate':
      return sprite(key, 30, 30, (g, w, h) => {
        g.fillStyle = '#7d6242';
        roundRect(g, 2, 2, w - 4, h - 4, 2); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.4; g.stroke();
        g.strokeStyle = 'rgba(40,28,16,0.55)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(4, 4); g.lineTo(w - 4, h - 4); g.stroke();
        g.beginPath(); g.moveTo(w - 4, 4); g.lineTo(4, h - 4); g.stroke();
      });
    case 'drum':
      return sprite(key, 24, 24, (g, w, h) => {
        const gr = g.createRadialGradient(w * 0.36, h * 0.34, 1, w / 2, h / 2, w / 2);
        gr.addColorStop(0, '#5c6a4a');
        gr.addColorStop(1, '#2f3728');
        g.fillStyle = gr;
        g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, 6.2832); g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.2; g.stroke();
        g.fillStyle = 'rgba(220,190,60,0.7)';
        g.fillRect(w * 0.2, h * 0.46, w * 0.6, 2.4);
      });
    case 'brazier':
      return sprite(key, 24, 24, (g, w, h) => {
        g.fillStyle = '#3a3a3c';
        g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, 6.2832); g.fill();
        const gr = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w * 0.36);
        gr.addColorStop(0, '#ffd76a');
        gr.addColorStop(0.5, '#ff7a29');
        gr.addColorStop(1, 'rgba(160,40,10,0.2)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(w / 2, h / 2, w * 0.36, 0, 6.2832); g.fill();
      });
    case 'floodlight':
      return sprite(key, 26, 18, (g, w, h) => {
        g.fillStyle = '#3c4149';
        roundRect(g, 2, h / 2 - 3, w * 0.42, 6, 2); g.fill();
        g.fillStyle = '#d8dce2';
        roundRect(g, w * 0.46, 2, w * 0.5, h - 4, 3); g.fill();
        g.fillStyle = 'rgba(255,244,200,0.85)';
        roundRect(g, w * 0.52, 4, w * 0.4, h - 8, 2); g.fill();
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
  } else if (kind === 'rifle') {
    roundRect(g, w * 0.08, h * 0.42, w * 0.84, h * 0.15, 1.4); g.fill();
    roundRect(g, w * 0.34, h * 0.55, w * 0.14, h * 0.32, 1.4); g.fill();  // caricatore curvo
    roundRect(g, w * 0.5, h * 0.32, w * 0.16, h * 0.11, 1); g.fill();     // maniglione
    g.fillStyle = '#3a3f47';
    roundRect(g, w * 0.06, h * 0.4, w * 0.12, h * 0.2, 1.4); g.fill();    // calcio
  } else if (kind === 'shotgun') {
    roundRect(g, w * 0.1, h * 0.4, w * 0.82, h * 0.13, 1.4); g.fill();
    g.fillStyle = '#6b4a2e';
    roundRect(g, w * 0.1, h * 0.38, w * 0.24, h * 0.18, 2); g.fill();     // calcio in legno
    g.fillStyle = '#1a1c20';
    roundRect(g, w * 0.46, h * 0.53, w * 0.2, h * 0.1, 1.4); g.fill();    // pompa
  } else if (kind === 'sniper') {
    roundRect(g, w * 0.04, h * 0.44, w * 0.9, h * 0.11, 1.2); g.fill();
    g.fillStyle = '#3a3f47';
    roundRect(g, w * 0.04, h * 0.4, w * 0.2, h * 0.2, 2); g.fill();
    g.fillStyle = '#0e1013';
    roundRect(g, w * 0.36, h * 0.3, w * 0.3, h * 0.1, 1.5); g.fill();     // ottica
    g.fillStyle = '#8fb6e8';
    g.fillRect(w * 0.63, h * 0.31, w * 0.03, h * 0.08);                   // lente
    g.strokeStyle = '#2a2f36'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(w * 0.7, h * 0.55); g.lineTo(w * 0.78, h * 0.72); g.stroke(); // bipiede
  } else if (kind === 'minigun') {
    g.fillStyle = '#2a2f36';
    roundRect(g, w * 0.2, h * 0.34, w * 0.3, h * 0.34, 3); g.fill();      // corpo motore
    g.fillStyle = '#12141a';
    for (let i = 0; i < 3; i++) {                                         // canne
      roundRect(g, w * 0.48, h * (0.36 + i * 0.12), w * 0.44, h * 0.07, 1); g.fill();
    }
    g.fillStyle = '#c9a24a';
    roundRect(g, w * 0.08, h * 0.42, w * 0.14, h * 0.2, 1.5); g.fill();   // nastro
  } else if (kind === 'bat' || kind === 'katana') {
    const wood = kind === 'katana';
    g.strokeStyle = wood ? '#1c2026' : '#8a6a42';
    g.lineWidth = Math.max(2, h * (wood ? 0.09 : 0.12));
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(w * 0.14, h * 0.62);
    g.lineTo(w * (wood ? 0.34 : 0.82), h * (wood ? 0.56 : 0.4));
    g.stroke();
    if (wood) {
      // Lama leggermente curva, filo chiaro: da sopra è tutto quello che si vede.
      g.strokeStyle = '#dfe6ef';
      g.lineWidth = Math.max(2, h * 0.1);
      g.beginPath();
      g.moveTo(w * 0.36, h * 0.55);
      g.quadraticCurveTo(w * 0.66, h * 0.4, w * 0.94, h * 0.34);
      g.stroke();
      g.strokeStyle = '#c33a33';
      g.lineWidth = Math.max(1, h * 0.05);
      g.beginPath(); g.moveTo(w * 0.32, h * 0.62); g.lineTo(w * 0.36, h * 0.5); g.stroke();
    } else {
      g.lineWidth = Math.max(3, h * 0.2);
      g.beginPath();
      g.moveTo(w * 0.56, h * 0.46);
      g.lineTo(w * 0.84, h * 0.4);
      g.stroke();
    }
  } else if (kind === 'molotov') {
    g.fillStyle = '#3f6b4a';
    roundRect(g, w * 0.34, h * 0.34, w * 0.3, h * 0.36, 4); g.fill();     // bottiglia
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(w * 0.38, h * 0.38, w * 0.05, h * 0.28);
    g.fillStyle = '#2f4a37';
    roundRect(g, w * 0.6, h * 0.42, w * 0.12, h * 0.18, 2); g.fill();     // collo
    g.fillStyle = '#e8dcc0';
    roundRect(g, w * 0.7, h * 0.44, w * 0.14, h * 0.12, 2); g.fill();     // straccio
  } else if (kind === 'grenade') {
    g.fillStyle = '#3f4a35';
    g.beginPath(); g.ellipse(w * 0.48, h * 0.52, w * 0.17, h * 0.2, 0, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(w * (0.34 + i * 0.09), h * 0.34);
      g.lineTo(w * (0.34 + i * 0.09), h * 0.7);
      g.stroke();
    }
    g.fillStyle = '#8d939b';
    roundRect(g, w * 0.44, h * 0.26, w * 0.09, h * 0.1, 1); g.fill();     // cucchiaio
    g.strokeStyle = '#c9a24a'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(w * 0.62, h * 0.3, w * 0.06, 0, 6.2832); g.stroke(); // anello
  } else if (kind === 'mine') {
    g.fillStyle = '#2c3138';
    g.beginPath(); g.ellipse(w * 0.5, h * 0.52, w * 0.24, h * 0.22, 0, 0, 6.2832); g.fill();
    g.strokeStyle = '#4a5058'; g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#c33a33';
    g.beginPath(); g.arc(w * 0.5, h * 0.52, w * 0.07, 0, 6.2832); g.fill();
  } else {
    roundRect(g, w * 0.22, h * 0.42, w * 0.5, h * 0.15, 1.5); g.fill();
    roundRect(g, w * 0.3, h * 0.54, w * 0.13, h * 0.26, 1.5); g.fill();
  }
}

/**
 * Esplosivo in volo o a terra. Piccolo per forza — 12 px — quindi conta solo che si
 * distingua a colpo d'occhio dalla ghiaia: la bottiglia è verde con lo straccio
 * acceso, la granata è verde scuro e tozza, la mina è un disco nero col led rosso.
 */
export function getThrownSprite(kind) {
  return sprite(`thrown:${kind}`, 16, 16, (g, w, h) => {
    const cx = w / 2, cy = h / 2;
    if (kind === 'molotov') {
      g.fillStyle = '#3f6b4a';
      roundRect(g, cx - 3, cy - 5, 6, 10, 2.4); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(cx - 2.2, cy - 4, 1.4, 7);
      g.fillStyle = '#ffb03a';
      g.beginPath(); g.arc(cx, cy - 6.2, 2.4, 0, 6.2832); g.fill();
      g.fillStyle = '#fff0b0';
      g.beginPath(); g.arc(cx, cy - 6.6, 1.2, 0, 6.2832); g.fill();
      return;
    }
    if (kind === 'mine') {
      g.fillStyle = '#22262c';
      g.beginPath(); g.ellipse(cx, cy, 6.4, 5.4, 0, 0, 6.2832); g.fill();
      g.strokeStyle = '#4a5058'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#3a4048';
      g.beginPath(); g.ellipse(cx, cy, 3.2, 2.6, 0, 0, 6.2832); g.fill();
      return;
    }
    g.fillStyle = '#3f4a35';
    g.beginPath(); g.ellipse(cx, cy, 4.6, 5.6, 0, 0, 6.2832); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.1; g.stroke();
    g.fillStyle = '#8d939b';
    roundRect(g, cx - 1.4, cy - 6.6, 2.8, 3, 1); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8;
    for (const dy of [-2, 0, 2]) {
      g.beginPath(); g.moveTo(cx - 4, cy + dy); g.lineTo(cx + 4, cy + dy); g.stroke();
    }
  });
}

/**
 * Icona per la barra armi dell'HUD: la sola sagoma, senza borsone sotto, e
 * **schiarita** — le armi sono disegnate quasi nere, e su un pannello scuro
 * sparirebbero. `source-atop` tinge solo i pixel già disegnati, quindi resta la
 * silhouette e basta, che è tutto quello che serve a 30 px.
 */
export function getWeaponIcon(id) {
  return sprite(`wicon:${id}`, 30, 20, (g, w, h) => {
    drawIconShape(g, w, h, id);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(214,226,242,0.82)';
    g.fillRect(0, 0, w, h);
  });
}

function drawIconShape(g, w, h, id) {
  if (id === 'fists') {
    g.fillStyle = '#d6a883';
    roundRect(g, w * 0.3, h * 0.3, w * 0.34, h * 0.44, 3); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(w * 0.34, h * (0.4 + i * 0.13));
      g.lineTo(w * 0.6, h * (0.4 + i * 0.13));
      g.stroke();
    }
    return;
  }
  drawGun(g, w, h, id);
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
  for (let f = 0; f < PED_FRAMES; f++) {
    getHeroSprite(f, 'walk');
    getHeroSprite(f, 'aim');
  }
  getHeroPortrait();
  getChopperSprite();
  for (const k of ['molotov', 'grenade', 'mine']) getThrownSprite(k);
  for (const type of ['lamp', 'tree', 'bin', 'hydrant', 'bench', 'vending', 'busstop', 'pallet', 'ac_unit', 'barrier']) {
    getPropSprite({ type, tint: 0, r: 12 });
  }
}
