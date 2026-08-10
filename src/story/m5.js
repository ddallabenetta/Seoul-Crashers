// M5 · «Il cortile del Bue Giallo» — 황소의 마당
//
// Il primo capitolo dell'Atto II porta la storia nei cortili. La città genera
// un solo cortile per banda, mentre il copione ne chiede tre: la ricerca qui
// privilegia quelli del 철마파 e usa gli altri piazzali disponibili come
// ripiego. Il motore dei turf può quindi crescere senza rendere la missione
// ingiocabile su una seed vecchia.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { storyPanels } from './storykit.js';

const TAKE_PRICE = 150000;

function pointOf(t, game, index = 0) {
  if (t) {
    const x = t.cx ?? t.x;
    const y = t.cy ?? t.y;
    if (Number.isFinite(x) && Number.isFinite(y)) return { turf: t, x, y };
  }
  // Fallback soltanto geometrico: non crea un nuovo cortile, ma lascia una
  // destinazione raggiungibile anche in una mappa di prova senza turfs.
  const w = game.city?.w || 16000;
  const h = game.city?.h || 24000;
  return { turf: null, x: w * (0.66 + index * 0.055), y: h * (0.72 + (index % 2) * 0.07) };
}

function turfId(site, index) {
  const t = site.turf;
  return t?.id || `hwangso-yard-${index}-${Math.round(site.x)}-${Math.round(site.y)}`;
}

function sites(game) {
  if (M5._sites?.game === game) return M5._sites.list;
  const all = (game.city?.turfs || []).filter((t) => {
    const p = pointOf(t, game);
    return game.city.areaAt?.(p.x, p.y)?.id !== 'busan'
      && game.city.areaAt?.(p.x, p.y)?.id !== 'jeju';
  });
  // Pyo ha perso i cortili al Cavallo di Ferro. Se la città ne ha soltanto uno,
  // gli altri due sono comunque piazzali della stessa guerra fra bande.
  const preferred = all.filter((t) => t.gang === 'cheolma');
  const ordered = [...preferred, ...all.filter((t) => !preferred.includes(t))];
  const out = [];
  for (let i = 0; i < 3; i++) out.push(pointOf(ordered[i], game, i));
  M5._sites = { game, list: out };
  return out;
}

function labelFor(site, index) {
  const t = site.turf;
  return t?.place || t?.hangul || `황소파 · cortile ${index + 1}`;
}

/**
 * Il parent può fornire un vero archivio persistente (`game.turfs`). Non si
 * scrive mai direttamente `city.turfs`: su una partita senza l'archivio il
 * fatto resta nel salvataggio narrativo e il motore può aggiungere il commercio
 * più avanti senza che questa scena debba conoscere la sua implementazione.
 */
function claim(ctx, site, index) {
  const game = ctx.game;
  const id = turfId(site, index);
  const api = game.turfs;
  let done = false;
  // API concreta del mercato: aggiorna il salvataggio, la proprietà visibile e
  // il commercio del cortile in un solo posto. La storia la preferisce sempre
  // quando il parent l'ha montata; `game.turfs` resta compatibile con le build
  // intermedie che espongono solo l'archivio narrativo.
  if (site.turf && game.shops?.claimTurf) {
    try {
      const result = game.shops.claimTurf(site.turf, game);
      done = result !== false || !!game.shops.ownsTurf?.(site.turf);
    } catch (_err) {
      done = false;
    }
  }
  if (api && !done) {
    for (const method of ['claim', 'transfer', 'take', 'setOwner']) {
      if (typeof api[method] !== 'function') continue;
      try {
        const result = api[method](id, 'baekho', game);
        done = result !== false;
      } catch (_err) {
        // Un'API aggiunta a metà sviluppo non deve bloccare la missione: il
        // flag qui sotto è il contratto minimo fra storia e motore.
      }
      if (done) break;
    }
  }
  ctx.flag(`turf:${id}:baekho`);
  ctx.flag(`m5-yard-${index + 1}`);
  if (!done && !api) ctx.flag('m5_turf_fallback');
}

function mapSite(ctx, site, index, active = true) {
  const id = `m5-yard-${index + 1}`;
  const label = labelFor(site, index);
  ctx.dropMapPoint(id);
  ctx.mapPoint({ id, x: site.x, y: site.y, label, color: '#ffd23f' });
  if (active) ctx.mark(site.x, site.y, { label, route: true });
}

function nearestRemaining(ctx) {
  const list = sites(ctx.game);
  const claimed = new Set(ctx.state.claimed || []);
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < list.length; i++) {
    if (claimed.has(i)) continue;
    const d = dist(ctx.game.player.x, ctx.game.player.y, list[i].x, list[i].y);
    if (d < bestD) { bestD = d; best = i; }
  }
  if (best === null) return null;
  ctx.unmark();
  mapSite(ctx, list[best], best, true);
  ctx.say(`Tre cortili — ${3 - claimed.size} da sistemare`);
  return best;
}

function yardPoint(ctx, site, index) {
  const id = `m5-yard-${index + 1}`;
  ctx.drop(id);
  ctx.point({
    id,
    key: 'E',
    text: 'tratta il cortile del 황소파',
    x: site.x,
    y: site.y,
    reach: 86,
    run: () => {
      const claimed = new Set(ctx.state.claimed || []);
      if (claimed.has(index)) return;
      const game = ctx.game;
      // Le tre strade restano leggibili: denaro = acquisto, arma = irruzione,
      // altrimenti si porta via il lavoro delle auto. Nessuna richiede un'API
      // nuova; il territorio cambia padrone nello stesso punto.
      const armed = game.player.weapon && game.player.weapon !== 'fists';
      let method = 'lavoro';
      if (game.player.money >= TAKE_PRICE) method = 'proroga pagata';
      else if (armed) method = 'irruzione';
      if (method === 'proroga pagata') {
        game.player.money -= TAKE_PRICE;
        ctx.toast('Il capocortile accetta la proroga · ₩150.000', 3);
      } else if (method === 'irruzione') {
        game.wanted?.report?.('gunshot', game);
        ctx.toast('Il cortile cambia padrone a colpi di pistola', 3);
      } else {
        ctx.toast('Le tre auto spariscono dal piazzale. Il lavoro finisce qui.', 3);
      }
      ctx.talk([
        { who: 'Capocortile', hangul: '철마파', text: '«Questo cortile era di Pyo. Adesso lo vuoi tu?»' },
        { who: 'Jae-min', text: `«Lo voglio libero. Metodo: ${method}.»` },
      ], () => {
        claim(ctx, site, index);
        ctx.state.claimed = [...(ctx.state.claimed || []), index];
        ctx.dropMapPoint(id);
        const next = nearestRemaining(ctx);
        if (next === null) ctx.next();
        else yardPoint(ctx, listAt(ctx.game, next), next);
      });
    },
  });
}

function listAt(game, index) { return sites(game)[index]; }

export const APERTURA = storyPanels('m5-open', [
  {
    palette: 1,
    hangul: '황소파',
    title: 'Il cortile del Bue Giallo',
    text: 'Sei uomini, una tenda gialla, un ventilatore. Il pomeriggio non ha ombre dove nascondersi.',
  },
  {
    palette: 1,
    hangul: '표만덕',
    title: 'Pyo Man-deok · 66 anni',
    lines: [
      { who: 'Narratore', text: 'Presta soldi a Gangnam da trentaquattro anni. 황소파: l\'usura.' },
      { who: 'Pyo', text: '«Il cane che torna al villaggio abbaia con l\'accento sbagliato.»' },
      { who: 'Jae-min', text: '«Non è così che fa il proverbio.»' },
      { who: 'Pyo', text: '«No. Ma tu lo sai, e questo è già qualcosa.»' },
    ],
  },
  {
    palette: 1,
    hangul: '황소파',
    title: 'Un bicchiere solo',
    text: 'Pyo versa da bere per una persona. Il suo ventaglio non si apre mai del tutto.',
    lines: [
      { who: 'Pyo', text: '«Soldi non te ne do. Ti do un mese in cui nessuno viene a bussare.»' },
      { who: 'Jae-min', text: '«E in cambio?»' },
      { who: 'Pyo', text: '«Tre cortili. Prendili, e il quartiere respira.»' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m5-close', [
  {
    palette: 1,
    hangul: '황소파',
    title: 'Sera nel cortile',
    text: 'Le insegne si accendono. La gente mangia sotto la tenda gialla: per un mese nessuno bussa.',
  },
  {
    palette: 1,
    hangul: '표만덕',
    title: 'La correzione',
    lines: [
      { who: 'Pyo', text: '«Tieni, figlio di Man-gi.»' },
      { who: 'Pyo', text: '«…di Dong-hyeok. Figlio di Dong-hyeok.»' },
      { who: 'Jae-min', text: '«Chi è Man-gi?»' },
      { who: 'Pyo', text: '«Uno che comandava qui prima di me. Morto prima che tu nascessi. Quasi prima.»' },
      { note: true, text: 'Nel ventaglio di Pyo c\'è una foto: un uomo senza cicatrici tiene un bambino.' },
    ],
  },
]);

export const M5 = {
  id: 'm5',
  title: 'Il cortile del Bue Giallo',
  hangul: '황소의 마당',
  act: 2,

  prepare(game) {
    // Il flag viene scritto subito: M8 può verificare che Dulchae sia ancora
    // vivo anche se il giocatore salta una missione o ricarica nel mezzo.
    if (!game.missions.flag('dulchae_alive')) game.missions.setFlag('dulchae_alive');
    sites(game);
  },

  phases: [
    panelPhase('m5-apertura', APERTURA),
    {
      id: 'cortili',
      hint: 'Prendi i tre cortili del 철마파',
      enter(ctx) {
        const list = sites(ctx.game);
        ctx.state.claimed = ctx.state.claimed || [];
        for (let i = 0; i < list.length; i++) {
          if (!(ctx.state.claimed || []).includes(i)) mapSite(ctx, list[i], i, false);
        }
        const next = nearestRemaining(ctx);
        if (next === null) { ctx.next(); return; }
        yardPoint(ctx, list[next], next);
      },
    },
    {
      id: 'ritorno-pyo',
      hint: 'Torna dal vecchio Pyo',
      enter(ctx) {
        const list = sites(ctx.game);
        const site = list[0];
        const label = '황소파';
        ctx.mark(site.x, site.y, { label, route: true });
        ctx.mapPoint({ id: 'm5-pyo', x: site.x, y: site.y, label, color: '#ffd23f' });
        ctx.point({
          id: 'm5-pyo', key: 'E', text: 'parla con Pyo Man-deok', x: site.x, y: site.y, reach: 86,
          run: () => {
            ctx.drop('m5-pyo');
            ctx.dropMapPoint('m5-pyo');
            ctx.talk([
              { who: 'Pyo', text: '«Tre cortili e nessuno sparo che non servisse. Tieni la proroga.»' },
              { who: 'Jae-min', text: '«Perché mi hai chiamato Man-gi?»' },
              { who: 'Pyo', text: '«Perché a volte un nome arriva prima della persona.»' },
            ], () => ctx.next());
          },
        });
      },
    },
    panelPhase('m5-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m5_turfs');
    game.missions.setFlag('pyo_knows_kumangi');
    game.hud.toast('황소의 마당 — completata', 3.2);
  },
};
