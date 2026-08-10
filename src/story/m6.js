// M6 · «Chi ha firmato per te» — 누가 네 이름을 썼나
//
// Una torre d'uffici, una cartellina e tre numeri che il giocatore deve mettere
// insieme da solo: 1992, 34 anni, 구만기. Gli interni sono generati, quindi la
// missione cerca un piano `사무실` a Gangnam e usa il punto esterno come ripiego
// per i probe/headless che non montano un edificio.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { findShop, freeSpot } from './places.js';
import { storyPanels } from './storykit.js';

function site(game) {
  if (M6._site?.game === game) return M6._site.value;
  const from = game.city?.spawn || game.player || { x: 0, y: 0 };
  const office = findShop(game, 'office', { district: 'gangnam', near: from });
  // Anche una vetrina non-office ha una porta e un piano: la torre della scena
  // resta visitabile in una seed minima, e il testo fa il resto.
  const value = office || findShop(game, 'clothes', { district: 'gangnam', near: from })
    || findShop(game, 'conv', { district: 'gangnam', near: from });
  M6._site = { game, value };
  return value;
}

function outside(game) {
  const s = site(game);
  if (s) return { x: s.x, y: s.y };
  const d = game.city?.districts?.find((q) => q.id === 'gangnam');
  return {
    x: d ? d.seed.x * game.city.w : game.city.w * 0.76,
    y: d ? d.seed.y * game.city.h : game.city.h * 0.78,
  };
}

function addMap(ctx, id, label, p, color = '#ffd23f') {
  ctx.dropMapPoint(id);
  ctx.mapPoint({ id, x: p.x, y: p.y, label, color });
}

function floorPoint(ctx, id, text, run) {
  const game = ctx.game;
  const s = site(game);
  const addInside = (shop, level, floor) => {
    if (!s || shop.id !== s.id || level !== (s.level || 0)) return;
    const p = freeSpot(floor, { x: floor.w * 0.54, y: floor.h * 0.46 });
    ctx.drop(id);
    ctx.point({ id, shop: s.id, level: s.level || 0, key: 'E', text, x: p.x, y: p.y, reach: 60, run });
  };
  ctx.on('floorShown', addInside);
  // Se il mock non ha interni, il documento è comunque un'interazione stradale
  // davanti alla torre: nessuna fase può rimanere senza un'azione.
  if (!game.indoors) {
    const p = outside(game);
    ctx.drop(id);
    ctx.point({ id, key: 'E', text, x: p.x, y: p.y, reach: 90, run });
  }
  const active = game.shops?.active;
  if (active && game.shops.floor) addInside(active.shop, active.cur, game.shops.floor);
}

function towerTravel(ctx, next) {
  const game = ctx.game;
  const p = outside(game);
  ctx.mark(p.x, p.y, { label: '한성개발', route: true });
  addMap(ctx, 'm6-tower', '한성개발 · Gangnam', p, '#38d6ff');
  ctx.on('shopEnter', (shop) => {
    const s = site(game);
    if (s && shop.id === s.id) next();
  });
  ctx.state.towerT = 0;
}

export const APERTURA = storyPanels('m6-open', [
  {
    palette: 0,
    hangul: '한성개발',
    title: 'La torre',
    text: 'Vetro, marmo, un albero vero nell\'atrio. Sono le 14:00: di notte qui non c\'è niente da trovare.',
  },
  {
    palette: 0,
    hangul: '윤하은',
    title: 'Ha-eun in borghese',
    lines: [
      { who: 'Ha-eun', text: '«Diciassette anni di indagini. Sa dove vanno a finire?»' },
      { who: 'Jae-min', text: '«Nei fascicoli.»' },
      { who: 'Ha-eun', text: '«Nei fascicoli di 한성개발. Io sono il loro geometra.»' },
    ],
  },
  {
    palette: 0,
    hangul: '윤',
    title: 'Una sigla in fondo alla pagina',
    text: 'La planimetria di Hongdae porta una sola firma: 윤 · Yoon. La sua.',
    lines: [
      { who: 'Ha-eun', text: '«Entri dall\'archivio. Io mi faccio vedere al piano terra.»' },
      { note: true, text: 'L\'allarme non è colpa di Jae-min: è Ha-eun che sposta la sicurezza.' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m6-close', [
  {
    palette: 0,
    hangul: '한성개발',
    title: 'Marciapiede',
    text: 'La gente passa attorno a Jae-min. In mano ha una fotocopia e non sa dove guardare.',
  },
  {
    palette: 0,
    hangul: '구만기',
    title: '1992',
    text: '구만기 · 미수금 정리 · 유아 1 · 백호 인수',
    lines: [
      { who: 'Narratore', text: 'Ku Man-gi · saldo del credito · un bambino · rilevato dal 백호파.' },
      { note: true, text: 'Libro dello 황소파, 1992. Seo Jae-min ha trentaquattro anni.' },
    ],
  },
  {
    palette: 0,
    hangul: '91.45',
    title: 'La cucina',
    lines: [
      { who: 'Jae-min', text: '«Tu lo sapevi.»' },
      { who: '91.45', kkachi: true, text: '«So quello che è stato detto ad alta voce.»' },
      { who: 'Jae-min', text: '«E che io sono stato comprato è stato detto ad alta voce?»' },
      { who: '91.45', kkachi: true, text: '«Una volta. In cucina. C\'era la radio accesa.»' },
    ],
  },
  // R2 vive qui per non aggiungere una missione vuota alla catena: il raccordo
  // resta una sequenza di immagini, esattamente come nel copione.
  {
    palette: 1,
    hangul: '1992',
    title: 'La cucina',
    text: 'Una cucina piccola, una radio sul frigo. Un bambino ascolta un uomo con la cicatrice sulla guancia destra.',
    lines: [
      { who: 'Voce dell\'uomo', text: '«Il conto di Man-gi è chiuso. Il bambino l\'ho preso io. Cresce qui.»' },
    ],
  },
  {
    palette: 1,
    hangul: '철거예정',
    title: 'Oggi',
    text: 'La stessa cucina è vuota. Sulla porta: 철거예정 · demolizione prevista.',
  },
]);

export const M6 = {
  id: 'm6',
  title: 'Chi ha firmato per te',
  hangul: '누가 네 이름을 썼나',
  act: 2,

  prepare(game) {
    const s = site(game);
    if (s) game.shops?.hold?.(s.id);
    if (!game.missions.flag('dulchae_alive')) game.missions.setFlag('dulchae_alive');
    // Il nome di Ha-eun esiste solo per questa scena: l'attore indoor non si
    // porta dietro la folla e rimane dove la missione l'ha lasciato.
    if (s && game.actors?.define) {
      game.actors.define('haeun', {
        indoor: true,
        shop: s.id,
        level: s.level || 0,
        kind: 'civil',
        name: 'Yoon Ha-eun',
        hangul: '윤하은',
        angle: Math.PI / 2,
        place: (f) => freeSpot(f, f.till ? { x: f.till.x - 28, y: f.till.y + 8 } : undefined),
      });
    }
  },

  phases: [
    panelPhase('m6-apertura', APERTURA),
    {
      id: 'torre',
      hint: 'Raggiungi 한성개발 alle 14:00',
      enter(ctx) { towerTravel(ctx, () => ctx.next()); },
      tick(dt, ctx) {
        // Arrivo robusto: con un palazzo reale `shopEnter` fa avanzare la fase,
        // con una mappa ridotta basta fermarsi davanti al marker.
        ctx.state.towerT += dt;
        const p = outside(ctx.game);
        if (!ctx.game.indoors && dist(ctx.game.player.x, ctx.game.player.y, p.x, p.y) < 92) {
          ctx.next();
        }
      },
    },
    {
      id: 'archivio',
      hint: 'Apri i faldoni dell\'archivio contratti',
      enter(ctx) {
        ctx.unmark();
        floorPoint(ctx, 'm6-archivio', 'apri la cartellina dell\'archivio', () => {
          ctx.drop('m6-archivio');
          ctx.dropMapPoint('m6-tower');
          ctx.flag('m6_contracts');
          ctx.flag('hansung_bought_hwangso_books');
          ctx.flag('kumangi_1992');
          ctx.talk([
            { text: 'Sette documenti. Tre sono inutili. Quattro hanno la stessa firma in fondo a destra.' },
            { who: 'Narratore', text: 'Perizia del mercato di Myeongdong: controfirma del privato 서재민. Data: undici mesi fa. Jae-min era a Los Angeles.' },
            { who: 'Narratore', text: 'Cessione dei crediti: 한성개발 ha comprato 1.400 posizioni dello 황소파, dal 1988 al 2010, nove anni fa.' },
            { who: 'Narratore', text: 'Pagina del 1992: 구만기 · 미수금 정리 · 유아 1 · 백호 인수.' },
            { who: 'Jae-min', text: '«Un bambino per chiudere un conto.»' },
            { note: true, text: 'Non è stato adottato: è stato incassato.' },
          ], () => ctx.next());
        });
      },
    },
    {
      id: 'ryu',
      hint: 'Prendi l\'ascensore di servizio',
      enter(ctx) {
        const p = outside(ctx.game);
        const run = () => {
          ctx.drop('m6-ryu');
          ctx.talk([
            { who: 'Narratore', text: '류광호 · Ryu Gwang-ho, presidente di 한성개발.' },
            { who: 'Ryu', text: '«Lei è più basso di come la immaginavo.»' },
            { who: 'Jae-min', text: '«Ci siamo già visti?»' },
            { who: 'Ryu', text: '«Lei firma le nostre carte da dodici anni, signor Seo. Sempre in fondo a destra.»' },
            { who: 'Ryu', text: '«Prenda l\'ascensore di servizio. Quello grande ha le telecamere.»' },
            { note: true, text: 'Ryu si toglie gli occhiali per la prima frase e li rimette per l\'ultima.' },
          ], () => ctx.next());
        };
        ctx.mark(p.x, p.y, { label: 'ascensore di servizio', route: true });
        addMap(ctx, 'm6-ryu', '20° piano', p, '#38d6ff');
        floorPoint(ctx, 'm6-ryu', 'entra nell\'ascensore di servizio', run);
      },
    },
    panelPhase('m6-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m6_revelation');
    game.missions.setFlag('two_jaemin_hint');
    game.hud.toast('누가 네 이름을 썼나 — completata', 3.2);
  },
};
