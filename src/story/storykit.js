// Attrezzi piccoli per le missioni della campagna.
//
// Le missioni restano file indipendenti e raccontano fatti diversi; qui stanno
// soltanto le tre forme che ripetono tutte: una tavola leggibile, una meta sulla
// strada e un punto con cui interagire. Così dieci capitoli non ricopiano dieci
// volte il lifecycle delicato di `MissionSystem`.
import { dist } from '../core/math.js';
import {
  px, py, wash, vignette, glow, block, sign, narrator, speech,
} from '../render/panelkit.js';

const PALETTES = [
  ['#172235', '#080b12', '#38d6ff'],
  ['#35251a', '#100b08', '#ffd23f'],
  ['#281826', '#0d080e', '#ff5fa2'],
  ['#1d2c22', '#090e0b', '#65d891'],
  ['#302020', '#100909', '#e8595e'],
];

/**
 * Tavole narrative generate da primitive Canvas. Ogni voce produce comunque la
 * propria funzione `draw`: il contenuto resta codice, senza asset o immagini.
 */
export function storyPanels(prefix, slides) {
  return slides.map((slide, index) => ({
    id: `${prefix}-${index + 1}`,
    draw(P) {
      const [top, bottom, accent] = PALETTES[(slide.palette ?? index) % PALETTES.length];
      wash(P, slide.top || top, slide.bottom || bottom, 0.55);
      glow(P, px(P, 0.72), py(P, 0.24), P.h * 0.62, slide.accent || accent, 0.18);
      // Una Seoul astratta ma riconoscibile: tetti irregolari, finestra, insegna.
      for (let i = 0; i < 7; i++) {
        const h = 0.18 + ((i * 37 + index * 19) % 23) / 100;
        block(P, px(P, i / 7 - 0.02), py(P, 0.54 - h), P.w * 0.17, P.h * h,
          i % 2 ? 'rgba(21,24,31,0.92)' : 'rgba(35,39,48,0.92)');
      }
      if (slide.hangul) {
        sign(P, slide.hangul, px(P, 0.72), py(P, 0.22), {
          size: P.h * 0.1, color: slide.accent || accent, glowR: P.h * 0.38,
        });
      }
      P.ctx.fillStyle = 'rgba(8,10,14,0.72)';
      P.ctx.fillRect(P.x, py(P, 0.58), P.w, P.h * 0.42);
      vignette(P, 0.58);
      if (slide.title || slide.text) {
        narrator(P, [slide.title, slide.text].filter(Boolean).join('\n'));
      }
      if (slide.lines?.length) speech(P, slide.lines);
    },
  }));
}

export function at(site) {
  if (!site) return null;
  return { x: site.cx ?? site.x, y: site.cy ?? site.y };
}

/** Una destinazione che si chiude arrivandoci. */
export function travelPhase(id, hint, getSite, opts = {}) {
  const key = `arrived:${id}`;
  return {
    id,
    hint,
    enter(ctx) {
      const site = at(typeof getSite === 'function' ? getSite(ctx.game, ctx) : getSite);
      if (!site) { ctx.next(); return; }
      ctx.state[key] = false;
      ctx.mark(site.x, site.y, { label: opts.label || '', route: opts.route !== false });
      if (opts.map !== false) ctx.mapPoint({ id, ...site, label: opts.label || '', color: opts.color });
    },
    tick(_dt, ctx) {
      if (ctx.state[key] || ctx.game.indoors) return;
      const site = at(typeof getSite === 'function' ? getSite(ctx.game, ctx) : getSite);
      if (!site || dist(ctx.game.player.x, ctx.game.player.y, site.x, site.y) > (opts.reach || 110)) return;
      ctx.state[key] = true;
      ctx.unmark();
      if (opts.lines?.length) ctx.talk(opts.lines, () => ctx.next());
      else ctx.next();
    },
  };
}

/** Un punto in strada: il giocatore arriva e decide quando far partire la scena. */
export function interactPhase(id, hint, getSite, text, lines, opts = {}) {
  return {
    id,
    hint,
    enter(ctx) {
      const site = at(typeof getSite === 'function' ? getSite(ctx.game, ctx) : getSite);
      if (!site) { ctx.next(); return; }
      ctx.mark(site.x, site.y, { label: opts.label || '' });
      ctx.mapPoint({ id, ...site, label: opts.label || '', color: opts.color });
      ctx.point({
        id, ...site, key: opts.key || 'E', text, reach: opts.reach || 64,
        onFoot: opts.onFoot !== false,
        run: () => {
          ctx.drop(id);
          ctx.dropMapPoint(id);
          ctx.unmark();
          if (lines?.length) ctx.talk(typeof lines === 'function' ? lines(ctx) : lines, () => ctx.next());
          else ctx.next();
        },
      });
    },
  };
}

/** Una scena breve senza meta, utile per raccordi e scelte. */
export function dialoguePhase(id, hint, lines, opts = {}) {
  return {
    id,
    hint,
    enter(ctx) {
      ctx.unmark();
      const play = () => {
        const seq = typeof lines === 'function' ? lines(ctx) : lines;
        if (seq?.length) ctx.talk(seq, () => ctx.next()); else ctx.next();
      };
      if (opts.waitForVehicle) {
        if (!ctx.game.player.onFoot) play();
        else ctx.on('enterVehicle', play);
      } else play();
    },
  };
}

/** Il landmark, turf, ospedale o negozio più vicino a un punto. */
export function nearest(list, origin, predicate = null) {
  let best = null;
  let bestD = Infinity;
  for (const item of list || []) {
    if (predicate && !predicate(item)) continue;
    const p = at(item);
    if (!p) continue;
    const d = (p.x - origin.x) ** 2 + (p.y - origin.y) ** 2;
    if (d < bestD) { bestD = d; best = item; }
  }
  return best;
}
