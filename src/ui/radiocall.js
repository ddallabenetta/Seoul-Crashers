// Il riquadro di 까치: il quadrante, una battuta, e sotto il fruscio.
//
// Non è `ui/dialogue.js` e non gli somiglia apposta. Un dialogo di missione ferma
// il mondo e aspetta che il giocatore prema Spazio; qui il giocatore **sta
// guidando**, quindi non c'è niente da premere, il mondo non si ferma e il
// riquadro non copre la strada: sta in alto, stretto, sopra la fascia libera fra
// la salute (a sinistra) e l'orologio (a destra).
//
// **Le righe di Kkachi non portano un nome ma la frequenza** (regola 5 del
// copione, e punto 1 di `08-domande-aperte.md`): i pannelli sono muti, quindi
// quello che nella cutscene era un timbro qui deve diventare un fatto
// tipografico. È lo stesso quadrante del pannello 26 dell'apertura e del secondo
// pannello di M1, ridotto a una fascia — chi lo vede in strada deve riconoscerlo.
import { FREQ } from '../core/kkachi.js';
import { drawParagraph, measureParagraph } from './text.js';
import { uiLayout } from './layout.js';

const MAX_W = 560;
const CYAN = '#38d6ff';
const AMBER = '#ffb163';

/** Rumore ripetibile: la stessa `i` dà sempre lo stesso valore in [0,1). */
function hash(i) {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

export function drawRadioCall(ctx, game) {
  const k = game.kkachi;
  if (!k || !k.visible) return;
  const w = game.camera.viewW;
  const h = game.camera.viewH;
  const L = uiLayout(w, h, game);
  const compact = L.compact;
  const pad = compact ? 11 : 14;
  // In verticale la colonna di sinistra (vitali, soldi, stelle) e l'orologio si
  // dividono già la fascia alta: il riquadro scende sotto invece di accavallarsi.
  const bw = Math.min(MAX_W, w - L.safeX * 2);
  const x = (w - bw) / 2;
  const inner = bw - pad * 2;
  const lineH = compact ? 18 : 21;
  // Il quadrante più la riga della frequenza. È l'altezza fissa della testata:
  // sotto ci va la battuta, e sotto ancora la banda che frigge.
  const headH = compact ? 30 : 34;

  const line = k.line;
  const body = line?.text || '';
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${compact ? '600 13px' : '600 15px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
  // `drawParagraph` prende la **baseline della prima riga**, non il bordo alto:
  // l'altezza del riquadro si costruisce da lì, o il testo esce dal fondo.
  const rows = body ? measureParagraph(ctx, body, inner, lineH) / lineH : 1;
  const bh = pad * 2 + headH + rows * lineH + 7;
  // Su uno schermo largo la fascia alta al centro è libera: vitali a sinistra,
  // orologio a destra, e in mezzo non c'è niente. Su uno stretto invece le due
  // colonne si toccano, quindi il riquadro scende **sotto** di loro — in
  // verticale sotto l'orologio e il titolo della missione, in orizzontale sotto
  // le stelle. Accavallarcisi vorrebbe dire perdere tutt'e due le cose.
  const y = L.safeTop + (compact ? (L.portrait ? 196 : 100) : 0);

  // Il riquadro compare e sparisce in un quarto di secondo: senza, una battuta
  // che dura due secondi sembra un errore di disegno.
  const alpha = Math.min(1, k.shown / 0.25) * (k.call ? 1 : Math.min(1, k.tail / 0.5));
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(8,11,16,0.86)';
  box(ctx, x, y, bw, bh, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(56,214,255,0.26)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // --- il quadrante -----------------------------------------------------------
  // Una fascia di tacche con l'indice fermo su 91.45. Non si muove: la manopola
  // è già lì, e un ago che oscilla direbbe che sta cercando qualcosa.
  const dx = x + pad;
  const dy = Math.round(y + pad + 8) + 0.5;
  const dw = inner;
  ctx.strokeStyle = 'rgba(140,166,188,0.45)';
  ctx.beginPath();
  ctx.moveTo(dx, dy);
  ctx.lineTo(dx + dw, dy);
  for (let i = 0; i <= 24; i++) {
    const tx = Math.round(dx + (dw * i) / 24) + 0.5;
    ctx.moveTo(tx, dy - (i % 4 === 0 ? 6 : 3));
    ctx.lineTo(tx, dy);
  }
  ctx.stroke();
  // L'indice, fermo. Un ago che oscilla direbbe che la stazione si sta cercando,
  // e questa è l'unica del gioco che non si cerca mai.
  const nx = Math.round(dx + dw * 0.485) + 0.5;
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nx, dy - 9);
  ctx.lineTo(nx, dy + 4);
  ctx.stroke();
  ctx.lineWidth = 1;

  // La frequenza al posto del nome: è il nome della voce (regola 5 del copione).
  const headBase = y + pad + headH - (compact ? 8 : 9);
  ctx.font = `700 ${compact ? 11 : 12}px system-ui, sans-serif`;
  ctx.fillStyle = CYAN;
  ctx.fillText(FREQ, dx, headBase);
  // Chi parla, quando non è lui. Kkachi non ha un nome e non ne prende uno.
  if (line?.who) {
    ctx.textAlign = 'right';
    ctx.fillStyle = AMBER;
    ctx.fillText(line.who, dx + dw, headBase);
    ctx.textAlign = 'left';
  }

  // --- la battuta -------------------------------------------------------------
  const ty = y + pad + headH + lineH - (compact ? 5 : 6);
  if (body) {
    ctx.font = `${compact ? '600 13px' : '600 15px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
    ctx.fillStyle = line.who ? '#eef2f8' : '#d6f2fb';
    drawParagraph(ctx, body, dx, ty, inner, { lineHeight: lineH });
  }

  // --- il fruscio -------------------------------------------------------------
  // Il silenzio del copione va **visto**, perché non si sente: fra due battute e
  // in coda alla chiamata resta la banda vuota che scorre. Dodici scatti al
  // secondo: più veloce diventa una texture, più lento diventa un lampeggio.
  const step = Math.floor(game.time * 12);
  const sy = y + bh - pad - 5;
  ctx.globalAlpha = alpha * (body ? 0.2 : 0.55);
  ctx.fillStyle = CYAN;
  for (let i = 0; i < 26; i++) {
    const r = hash(step * 31 + i * 7);
    if (r > 0.62) continue;
    ctx.fillRect(dx + Math.round(hash(step * 17 + i) * (inner - 22)), Math.round(sy + hash(i * 3.3) * 5), 4 + Math.round(r * 14), 1);
  }
  ctx.restore();
}

function box(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
