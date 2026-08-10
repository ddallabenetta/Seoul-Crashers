// M11 · «Il traghetto delle 04:10» — 04시 10분 배
//
// La traversata è un cambio di regione reale (`Game.travelTo`), non un teletrasporto
// narrativo nascosto: la mappa resta unica e le destinazioni di Jeju hanno quindi
// lo stesso blip e la stessa rotta delle strade di Seoul e Busan.
import { panelPhase } from '../core/missions.js';
import { storyPanels, travelPhase, interactPhase } from './storykit.js';

function area(game, id) {
  return game.city?.areas?.find((a) => a.id === id) || null;
}

function landmark(game, id, region, u = 0.5, v = 0.5) {
  const lm = game.city?.landmarks?.find((item) => item.id === id);
  if (lm) return { x: lm.x, y: lm.y };
  const a = area(game, region);
  if (a) return { x: a.x0 + a.city.w * u, y: a.y0 + a.city.h * v };
  return { x: game.player.x, y: game.player.y };
}

function pier(game) {
  const p = (game.city?.piers || []).find((item) => item.region === 'busan')
    || game.city?.piers?.[0];
  if (p) return { x: p.x + p.w * 0.35, y: p.y + p.h * 0.5 };
  return landmark(game, 'jeju-port', 'jeju', 0.2, 0.4);
}

function station(game, region, id = null) {
  return game.city?.transitStations?.find((s) => id && s.id === id)
    || game.city?.transitStations?.find((s) => s.id === (region === 'jeju' ? 'jeju-city' : 'hongik-univ'))
    || game.city?.transitStations?.find((s) => s.region === region)
    || null;
}

function travel(game, region, id) {
  const st = station(game, region, id);
  if (typeof game.travelTo === 'function') {
    game.travelTo(region, st?.id || id, { silent: false });
    return;
  }
  const a = area(game, region);
  if (a) {
    game.player.x = a.x0 + a.city.w * 0.5;
    game.player.y = a.y0 + a.city.h * 0.5;
  }
}

export const APERTURA = storyPanels('m11-apertura', [
  {
    title: '04:10 · 부산항',
    text: 'Il traghetto è illuminato. Tre auto in coda, una sola direzione.',
    hangul: '04:10',
    palette: 0,
  },
  {
    title: 'La stiva',
    text: 'L’auto è legata con le cinghie. Jae-min resta seduto dentro.',
    hangul: '부산항',
    palette: 1,
  },
  {
    title: 'Mare aperto',
    text: 'All’alba non si vede nessuna costa. La frequenza 91.45 si perde nel fruscio.',
    hangul: '…',
    palette: 2,
    lines: [
      { who: '91.45', kkachi: true, text: '«…sto perdendo… la banda non arriva…»' },
      { who: 'Jae-min', text: '«Aspetta—»' },
      { who: '91.45', kkachi: true, text: '«…»' },
    ],
  },
  {
    title: 'Jeju',
    text: 'Il cono di 한라산 ha una nuvola sopra. La costa è nera di roccia.',
    hangul: '제주',
    palette: 3,
  },
]);

export const CHIUSURA = storyPanels('m11-chiusura', [
  {
    title: 'Stanza 5',
    text: 'Seo Dong-hyeok è vivo, pulito, curato. Sulla porta c’è un altro nome.',
    hangul: '요양',
    palette: 0,
    lines: [
      { who: 'Dong-hyeok', text: '«Ha piovuto?»' },
      { who: 'Jae-min', text: '«No.»' },
      { who: 'Dong-hyeok', text: '«Ha piovuto?»' },
    ],
  },
  {
    title: '144 firme',
    text: 'Una data al mese per dodici anni. L’ultima è dell’8 agosto; accanto, la prossima.',
    hangul: '서명 취득',
    palette: 1,
    lines: [
      { who: 'Infermiera', text: '«Viene un signore da Seoul. Gli tiene la mano e firma.»' },
      { who: 'Jae-min', text: '«Che signore?»' },
      { who: 'Infermiera', text: '«Suo figlio.» (guarda Jae-min) «…Un momento.»' },
    ],
  },
  {
    title: 'La cassetta',
    text: 'Nel comodino c’è una registrazione di quattordici anni fa: la voce di Dong-hyeok spiega Kkachi.',
    hangul: '까치',
    palette: 4,
    lines: [
      { who: 'Dong-hyeok · cassetta', text: '«Non è un uomo. Non chiedetegli mai una cosa che non è stata detta prima: inventa.»' },
    ],
  },
  {
    title: 'Ritorno',
    text: 'Jae-min stringe la mano vuota di suo padre e non gli dà la penna.',
    hangul: '서울',
    palette: 2,
    lines: [
      { who: 'Jae-min', text: '«Non ho niente da farti firmare.»' },
      { who: 'Dong-hyeok', text: '«Ha piovuto?»' },
      { who: 'Jae-min', text: '«Sì. A Seoul piove.»' },
    ],
  },
]);

export const R4 = storyPanels('r4', [
  {
    title: 'Il quarto salvataggio',
    text: 'Buio in auto. Il motore è acceso sul traghetto di ritorno.',
    hangul: '91.45',
    palette: 0,
    lines: [
      { who: '91.45', kkachi: true, text: '«Sei stato via undici ore.»' },
      { who: 'Jae-min', text: '«Ho trovato la cassetta.»' },
      { who: '91.45', kkachi: true, text: '«Non ho detto niente di sbagliato, quindi non è quella la domanda.»' },
    ],
  },
  {
    title: 'La lancetta',
    text: 'Il quadrante trema fra 91.4 e 91.5 e si ferma. Nel menu appare una quarta partita: 서재민.',
    hangul: '12년 전',
    palette: 2,
  },
]);

const boardLines = [
  { who: 'Narratore', text: 'La rampa del traghetto si chiude. Il mare separa Busan da Jeju.' },
  { who: 'Jae-min', text: '«Se torno, lui sarà ancora qui?»' },
  { who: 'Narratore', text: 'Nessuna risposta arriva dalla radio.' },
];

const resortLines = [
  { who: 'Infermiera', text: '«Centoquarantaquattro righe, una al mese. Accanto a ognuna: 서명 취득 — firma acquisita.»' },
  { who: 'Jae-min', text: '«L’ultima?»' },
  { who: 'Infermiera', text: '«Otto agosto. Il signor Seo è tranquillo quando c’è suo figlio.»' },
  { who: 'Narratore', text: 'La mano di Dong-hyeok non è una vita: è una firma tenuta al caldo.' },
];

export const M11 = {
  id: 'm11',
  title: 'Il traghetto delle 04:10',
  hangul: '04시 10분 배',
  act: 3,

  prepare(game) {
    // Il traghetto parte sempre alle 04:10, anche se il giocatore ha impiegato
    // più tempo del previsto a Busan. Il meteo continua a essere quello del mondo.
    if (game.dayCycle) game.dayCycle.hour = 4 + 10 / 60;
  },

  phases: [
    panelPhase('m11-apertura', APERTURA),

    {
      id: 'm11-terminal',
      hint: 'Raggiungi il terminal dei traghetti di 부산항',
      enter(ctx) {
        const p = pier(ctx.game);
        ctx.mark(p.x, p.y, { label: '부산항 · 04:10', route: true });
        ctx.mapPoint({ id: 'm11-ferry', ...p, label: 'traghetto 04:10', color: '#62c9ff' });
        // L'incontro è facoltativo e senza blip: se M10 non lo ha visto, può
        // ancora trovarlo qui sedendosi nella sala d'attesa.
        if (!ctx.game.missions.flag('dulchaeDead') && !ctx.game.missions.flag('dulchae_dead')
          && !ctx.game.actors?.isDead?.('dulchae') && !ctx.game.missions.flag('dulchaeTerminal')) {
          ctx.game.actors?.define?.('dulchae', {
            x: p.x, y: p.y, kind: 'gangster', name: 'Dulchae', hangul: '둘째',
            angle: Math.PI, state: 'post',
          });
          ctx.point({
            id: 'm11-dulchae-terminal', x: p.x, y: p.y, key: 'E', reach: 72,
            text: 'siediti sulle sedie arancioni',
            run: () => {
              ctx.game.missions.setFlag('dulchaeAlive');
              ctx.game.missions.setFlag('dulchae_alive');
              ctx.game.missions.setFlag('dulchaeTerminal');
              ctx.drop('m11-dulchae-terminal');
              ctx.talk([
                { who: 'Jae-min', text: '«Mi hai seguito.»' },
                { who: 'Dulchae', text: '«Sapevo l’orario. Non è la stessa cosa.»' },
                { who: 'Dulchae', text: '«Portati una giacca. A Jeju di notte tira.»' },
              ]);
            },
          });
        }
        ctx.point({
          id: 'm11-board', x: p.x, y: p.y, key: 'E', reach: 90,
          text: 'imbarcati sul traghetto delle 04:10',
          run: () => {
            ctx.drop('m11-board');
            ctx.drop('m11-dulchae-terminal');
            ctx.unmark();
            ctx.talk(boardLines, () => {
              travel(ctx.game, 'jeju', 'jeju-city');
              ctx.next();
            });
          },
        });
      },
      tick(_dt, ctx) {
        if (!ctx.game.actors?.isDead?.('dulchae')) return;
        ctx.game.missions.setFlag('dulchaeAlive', false);
        ctx.game.missions.setFlag('dulchae_alive', false);
        ctx.game.missions.setFlag('dulchaeDead');
        ctx.game.missions.setFlag('dulchae_dead');
        ctx.drop('m11-dulchae-terminal');
      },
    },

    travelPhase('m11-jeju-drive', 'Guida lungo la costa fino a 서귀포', (game) => landmark(game, 'seogwipo', 'jeju', 0.72, 0.8), {
      label: '서귀포 · casa di cura', route: true,
    }),

    interactPhase('m11-stanza', 'Entra nella stanza 5', (game) => landmark(game, 'seogwipo', 'jeju', 0.72, 0.8),
      'entra nella casa di cura', resortLines, { label: '요양 · stanza 5', color: '#62c9ff', reach: 130 }),

    {
      id: 'm11-return-ferry',
      hint: 'Torna a Seoul con la cassetta',
      enter(ctx) {
        const p = landmark(ctx.game, 'jeju-port', 'jeju', 0.22, 0.38);
        ctx.mark(p.x, p.y, { label: '제주항 · ritorno', route: true });
        ctx.mapPoint({ id: 'm11-return', ...p, label: 'traghetto di ritorno', color: '#62c9ff' });
        ctx.point({
          id: 'm11-return', x: p.x, y: p.y, key: 'E', reach: 120,
          text: 'prendi il traghetto di ritorno',
          run: () => {
            ctx.drop('m11-return');
            ctx.unmark();
            ctx.talk([
              { who: 'Narratore', text: 'La cassetta resta sul sedile. Jeju si allontana dietro la pioggia.' },
            ], () => {
              travel(ctx.game, 'seoul', 'hongik-univ');
              ctx.next();
            });
          },
        });
      },
    },

    panelPhase('r4', R4),
    panelPhase('m11-chiusura', CHIUSURA),
  ],

  finish(game) {
    if (game.actors?.isDead?.('dulchae')) {
      game.missions.setFlag('dulchaeAlive', false);
      game.missions.setFlag('dulchae_alive', false);
      game.missions.setFlag('dulchaeDead');
      game.missions.setFlag('dulchae_dead');
    }
    game.missions.setFlag('m11');
    game.missions.setFlag('donghyeokAlive');
    game.missions.setFlag('jejuCalendar144');
    game.missions.setFlag('kkachiCassette');
    game.hud?.toast('04시 10분 배 — completata', 3.2);
  },
};

export default M11;
