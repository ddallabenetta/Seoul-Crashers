// Il riquadro di chi parla in macchina (`core/passenger.js`).
//
// Sta dove sta quello di 까치 — fascia alta, stretto, sopra la strada — e **non gli somiglia**
// apposta: niente quadrante e niente frequenza, ma il nome di chi parla e un filo ambra. Le due
// voci non si sentono mai insieme (con qualcuno a bordo la radio di 까치 tace), quindi possono
// occupare lo stesso posto senza accavallarsi.
import { drawParagraph, measureParagraph } from './text.js';
import { uiLayout } from './layout.js';

const MAX_W = 560;
const AMBER = '#ffb163';
const CYAN = '#7fd8ff';

export function drawPassengerCall(ctx, game) {
  const p = game.passenger;
  if (!p || !p.visible) return;
  const line = p.line || p.last;
  if (!line) return;
  const w = game.camera.viewW;
  const h = game.camera.viewH;
  const L = uiLayout(w, h, game);
  const compact = L.compact;
  const pad = compact ? 11 : 14;
  const bw = Math.min(MAX_W, w - L.safeX * 2);
  const x = (w - bw) / 2;
  const inner = bw - pad * 2;
  const lineH = compact ? 18 : 21;
  const headH = compact ? 20 : 22;

  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${compact ? '600 13px' : '600 15px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
  const body = line.text || '';
  const rows = body ? measureParagraph(ctx, body, inner, lineH) / lineH : 1;
  const bh = pad * 2 + headH + rows * lineH + 2;
  // Come il riquadro di 까치: in verticale scende sotto l'orologio e il titolo della missione.
  const y = L.safeTop + (compact ? (L.portrait ? 196 : 100) : 0);

  const alpha = p.line ? Math.min(1, p.shown / 0.2) : Math.min(1, p.tail / 0.4);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(14,11,8,0.88)';
  ctx.beginPath();
  const r = 9;
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + bw, y, x + bw, y + bh, r);
  ctx.arcTo(x + bw, y + bh, x, y + bh, r);
  ctx.arcTo(x, y + bh, x, y, r);
  ctx.arcTo(x, y, x + bw, y, r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,177,99,0.34)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Il nome, e se è al telefono una cornetta di testo: chi guida deve capire che quella voce non è in auto.
  ctx.font = `700 ${compact ? 11 : 12}px system-ui, "Apple SD Gothic Neo", sans-serif`;
  ctx.fillStyle = line.who === 'Jae-min' ? CYAN : AMBER;
  const label = (line.phone && line.who !== 'Jae-min' ? '☎ ' : '') + (line.who || '');
  ctx.fillText(label, x + pad, y + pad + 10);

  if (body) {
    ctx.font = `${compact ? '600 13px' : '600 15px'} system-ui, "Apple SD Gothic Neo", sans-serif`;
    ctx.fillStyle = '#f3ece2';
    drawParagraph(ctx, body, x + pad, y + pad + headH + lineH - (compact ? 5 : 6), inner, { lineHeight: lineH });
  }
  ctx.restore();
}
