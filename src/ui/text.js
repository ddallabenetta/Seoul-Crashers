// Testo su più righe.
//
// Fino ai pannelli il gioco non ne aveva mai avuto bisogno: HUD, menu e listini
// scrivono una riga alla volta e la accorciano con i puntini quando non ci sta
// (`shopmenu.js`). I pannelli sono **solo testo** e la decisione presa con
// l'utente dice che se una battuta non ci sta si taglia la battuta, **non si
// rimpicciolisce il corpo** — cioè: corpo fisso, a capo automatico, e chi scrive
// il copione vede subito quando ha esagerato.
//
// Il taglio è avido sugli spazi, con una via d'uscita per il pezzo unico più largo
// della colonna (un indirizzo, una targa, una parola in hangul senza spazi): quello
// si spezza a carattere, perché una riga che sborda dal pannello è peggio di una
// parola spezzata.

/**
 * Le righe in cui `text` si divide dentro `maxW`. Gli a capo scritti a mano nel
 * copione si rispettano: nel testo dei pannelli separano le battute, e unirle
 * sarebbe un errore di regia, non di impaginazione.
 */
export function wrapLines(ctx, text, maxW) {
  maxW = Math.max(1, maxW);
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!para) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const probe = line ? `${line} ${word}` : word;
      if (ctx.measureText(probe).width <= maxW) { line = probe; continue; }
      if (line) { out.push(line); line = ''; }
      // La parola da sola sfonda la colonna: si spezza a carattere.
      if (ctx.measureText(word).width > maxW) {
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxW && chunk) { out.push(chunk); chunk = ''; }
          chunk += ch;
        }
        line = chunk;
      } else {
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/**
 * Scrive un paragrafo e restituisce **quanto è alto**: chi impagina un pannello
 * mette la battuta dopo senza doversi rifare i conti a mano.
 * `y` è la baseline della prima riga.
 */
export function drawParagraph(ctx, text, x, y, maxW, opts = {}) {
  maxW = Math.max(1, maxW);
  const { lineHeight = 20, align = 'left', maxLines = 0 } = opts;
  let lines = wrapLines(ctx, text, maxW);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = ellipsize(ctx, `${lines[maxLines - 1]}…`, maxW);
  }
  const prev = ctx.textAlign;
  ctx.textAlign = align;
  const ax = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x;
  lines.forEach((l, i) => ctx.fillText(l, ax, y + i * lineHeight));
  ctx.textAlign = prev;
  return lines.length * lineHeight;
}

/** Quanto sarebbe alto, senza disegnare: serve a centrare un blocco. */
export function measureParagraph(ctx, text, maxW, lineHeight = 20) {
  return wrapLines(ctx, text, Math.max(1, maxW)).length * lineHeight;
}

/** Una riga sola accorciata con i puntini. */
export function ellipsize(ctx, text, maxW) {
  maxW = Math.max(1, maxW);
  if (ctx.measureText(text).width <= maxW) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxW) s = s.slice(0, -1);
  return `${s}…`;
}
