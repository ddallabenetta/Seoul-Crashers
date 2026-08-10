// M12 · «Hanseong» — 한성
//
// L'assedio è il set piece finale, ridotto a una sequenza di obiettivi leggibili:
// difesa di Hongdae, fascicolo di Ha-eun, il secondo giubbotto e la torre. Il
// combattimento ordinario resta al motore; qui si tengono solo i passaggi che la
// storia deve ricordare e la scelta di Dulchae, che alimenta il finale nascosto.
import { panelPhase } from '../core/missions.js';
import { interactPhase, storyPanels, travelPhase } from './storykit.js';

function area(game, id) {
  return game.city?.areas?.find((a) => a.id === id) || null;
}

function place(game, id, region = 'seoul', u = 0.5, v = 0.5) {
  const lm = game.city?.landmarks?.find((item) => item.id === id || item.name === id || item.hangul === id);
  if (lm) return { x: lm.x, y: lm.y };
  const a = area(game, region);
  if (a) return { x: a.x0 + a.city.w * u, y: a.y0 + a.city.h * v };
  return { x: game.player.x, y: game.player.y };
}

function hongdae(game) {
  const a = area(game, 'seoul');
  const d = game.city?.districts?.find((item) => item.id === 'hongdae' && item.region === 'seoul');
  if (d) return { x: d.seed.x * game.city.w, y: d.seed.y * game.city.h };
  if (a) return { x: a.x0 + a.city.w * 0.45, y: a.y0 + a.city.h * 0.22 };
  return { x: game.player.x, y: game.player.y };
}

function tower(game) {
  return place(game, 'COEX Mall', 'seoul', 0.78, 0.79);
}

function seoulDistrictPoints(game) {
  const out = [];
  for (const d of game.city?.districts || []) {
    if (d.region && d.region !== 'seoul') continue;
    if (!d.seed || out.some((p) => p.label === d.hangul)) continue;
    out.push({
      id: `m12-district-${d.id}`,
      x: d.seed.x * game.city.w,
      y: d.seed.y * game.city.h,
      label: `${d.hangul} · periziato`,
      color: '#8e96a4',
    });
  }
  return out.slice(0, 7);
}

export const APERTURA = storyPanels('m12-apertura', [
  {
    title: '20 settembre · notte',
    text: 'Hongdae è sotto l’acqua. Le transenne chiudono le strade; le gru arrivano all’alba.',
    hangul: '홍대',
    palette: 0,
    lines: [
      { who: 'Narratore', text: '«21 settembre. La data è sul manifesto da sei settimane.»' },
    ],
  },
  {
    title: 'Jo Ok-bun',
    text: 'Il banco dei pegni è vuoto. Jo siede in mezzo alla strada con una cassetta della frutta.',
    hangul: '전당포',
    palette: 1,
    lines: [
      { who: 'Jo', text: '«Ho quarantun anni di roba in testa. Se me la portano via, dove la mettono?»' },
      { who: 'Jo', text: '«Tieni. Sono i miei nove. Tu hai visto gli altri.»' },
    ],
  },
  {
    title: 'Le bande',
    text: '백호파, 황소파 e 철마파 si mettono in fila davanti alle transenne. Nessuno parla.',
    hangul: '백호파',
    palette: 3,
  },
  {
    title: 'Le luci blu',
    text: 'Le volanti arrivano dai due capi della strada. Sopra, i teli della Hanseong tremano.',
    hangul: '한성개발',
    palette: 4,
  },
]);

export const CHIUSURA = storyPanels('m12-chiusura', [
  {
    title: 'Ventesimo piano',
    text: 'Ryu Gwang-ho ha già versato due whisky e non scappa.',
    hangul: '강남',
    palette: 0,
    lines: [
      { who: 'Ryu', text: '«Suo padre non mi ha venduto il quartiere. Me lo ha affittato. Dodici anni.»' },
      { who: 'Ryu', text: '«Lei è la seconda copia di un documento, signor Seo.»' },
    ],
  },
  {
    title: 'Il conto',
    text: 'Sul tavolo: il registro ricomposto, il fascicolo di Ha-eun, la cartellina delle firme e le fatture dell’ospedale.',
    hangul: '성심',
    palette: 1,
    lines: [
      { who: 'Narratore', text: '«Le voci delle fatture sono esattamente le morti di questa partita.»' },
    ],
  },
  {
    title: 'Tre cose',
    text: 'Registro del quartiere. Diciassette anni di indagini. Calendario delle firme di Jeju.',
    hangul: '선택',
    palette: 2,
    lines: [
      { who: 'Narratore', text: '«Il gioco si ferma qui e chiede.»' },
    ],
  },
]);

const defenceLines = [
  { who: 'Narratore', text: 'Le gru avanzano, le bande combattono con te e la polizia resta in mezzo.' },
  { who: 'Chun-sik', text: '«Se restiamo qui, il quartiere resta qui.»' },
  { who: 'Ha-eun', text: '«Diciassette anni. Sono tutti nella mia cartellina.»' },
];

function dulchaePhase() {
  return {
    id: 'm12-dulchae',
    hint: 'Due uomini, lo stesso giubbotto: scegli chi lasci andare',
    enter(ctx) {
      const p = hongdae(ctx.game);
      ctx.mark(p.x, p.y, { label: 'due giubbotti · 서재민', route: false });
      ctx.mapPoint({ id: 'm12-second-jacket', ...p, label: 'secondo giubbotto', color: '#ff5fa2' });
      if (ctx.game.missions.flag('dulchaeDead') || ctx.game.missions.flag('dulchae_dead')
        || ctx.game.actors?.isDead?.('dulchae')) {
        // Non chiudere la fase dentro `enter`: MissionSystem deve prima finire
        // di apparecchiare e solo il frame successivo può avanzare.
        ctx.state.skipDulchae = true;
        return;
      }
      const finish = (alive) => {
        ctx.state.dulchaeResolved = true;
        ctx.game.missions.setFlag('dulchaeAlive', alive);
        ctx.game.missions.setFlag('dulchae_alive', alive);
        ctx.game.missions.setFlag('dulchaeDead', !alive);
        ctx.game.missions.setFlag('dulchae_dead', !alive);
        ctx.drop('m12-dulchae-pass');
        ctx.drop('m12-dulchae-kill');
        ctx.unmark();
        ctx.next();
      };
      ctx.point({
        id: 'm12-dulchae-pass', x: p.x, y: p.y, key: 'E', reach: 100,
        text: 'lascia cadere la cartellina',
        run: () => {
          ctx.talk([
            { who: 'Dulchae', text: '«Dove vai?»' },
            { who: 'Jae-min', text: '«Da nessuna parte.»' },
            { who: 'Dulchae', text: '«Volevo solo che da lontano ne restasse uno.»' },
          ], () => finish(true));
        },
      });
      ctx.point({
        id: 'm12-dulchae-kill', x: p.x, y: p.y, key: 'Q', reach: 100,
        text: 'spara a Dulchae',
        run: () => {
          ctx.talk([{ who: 'Narratore', text: 'Un nome solo sulle radio della polizia. Un corpo chiude la pratica.' }], () => finish(false));
        },
      });
    },
    tick(_dt, ctx) {
      if (ctx.state.skipDulchae) ctx.next();
    },
  };
}

function finalConfrontationLines(ctx) {
  const n = Number(ctx.game.stats?.deaths || 0);
  const lines = [
    { who: 'Ryu', text: '«Io compilo. Sopra di me c’è un consorzio, sopra il consorzio una banca, sopra la banca nessuno da incontrare.»' },
    { who: 'Ryu', text: '«Domattina alle nove le gru partono lo stesso. Io ho soltanto la penna.»' },
  ];
  if (n > 0) {
    lines.push({ who: 'Narratore', text: `«Fatture del 병원 성심, intestate a 한성개발. Le voci sono ${n}.»` });
    lines.push({ who: 'Jae-min', text: '«Queste sono mie.»' });
    lines.push({ who: 'Ryu', text: '«Sono nostre. Le abbiamo pagato la vita, a rate.»' });
  } else {
    lines.push({ who: 'Ryu', text: '«Lei non ci è mai costato niente. Dodici anni di copertura e nessuna fattura.»' });
    lines.push({ who: 'Ryu', text: '«È il nostro miglior investimento, signor Seo.»' });
  }
  return lines;
}

export const M12 = {
  id: 'm12',
  title: 'Hanseong',
  hangul: '한성',
  act: 3,

  prepare(game) {
    const m = game.missions;
    const dead = m.flag('dulchaeDead') || m.flag('dulchae_dead') || game.actors?.isDead?.('dulchae');
    const alive = m.flag('dulchaeAlive') || m.flag('dulchae_alive');
    if (!dead && !alive) {
      m.setFlag('dulchaeAlive');
      m.setFlag('dulchae_alive');
    }
  },

  phases: [
    panelPhase('m12-apertura', APERTURA),

    {
      id: 'm12-difesa',
      hint: 'Difendi Hongdae fino all’arrivo delle gru',
      enter(ctx) {
        const p = hongdae(ctx.game);
        ctx.mark(p.x, p.y, { label: '홍대 · difesa', route: true });
        for (const point of seoulDistrictPoints(ctx.game)) ctx.mapPoint(point);
        ctx.point({
          id: 'm12-defend', x: p.x, y: p.y, key: 'E', reach: 110,
          text: 'resisti alle gru e alle volanti',
          run: () => {
            ctx.drop('m12-defend');
            ctx.unmark();
            ctx.talk(defenceLines, () => ctx.next());
          },
        });
      },
    },

    interactPhase('m12-haeun', 'Raccogli il fascicolo di Ha-eun', (game) => hongdae(game),
      'prendi il fascicolo', [
        { who: 'Ha-eun', text: '«Diciassette anni. Sono la mappa con cui vi hanno censiti.»' },
        { who: 'Ha-eun', text: '«Adesso è una prova. Dipende da chi ce l’ha.»' },
      ], { label: 'fascicolo · 17 anni', color: '#8fb6e8', reach: 110 }),

    dulchaePhase(),

    travelPhase('m12-torre', 'Sali alla torre di Gangnam', (game) => tower(game), {
      label: '강남 · torre', route: true,
    }),

    interactPhase('m12-ryu', 'Confronta Ryu Gwang-ho', (game) => tower(game),
      'confronta Ryu al ventesimo piano', finalConfrontationLines, {
        label: 'Ryu · ventesimo piano', color: '#e8595e', reach: 140,
      }),

    panelPhase('m12-chiusura', CHIUSURA),
  ],

  finish(game) {
    // `hospital.js` legge proprio questo flag al prossimo respawn. Va alzato
    // prima che il flusso dei finali possa cambiare modalità o salvare.
    game.missions.setFlag('m12');
    game.missions.setFlag('hanseongConfronted');
    game.hud?.toast('한성 — completata', 3.2);
  },
};

export default M12;
