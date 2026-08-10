// M7 · «Sei ore» — 여섯 시간
//
// Qui il ricercato non è un ostacolo ma il mezzo per arrivare a Byeon Gi-tae.
// La fase ascolta `busted`: il listener globale della MissionSystem ricostruisce
// prima la fase dopo l'arresto, poi questo listener la fa avanzare. Morire resta
// un fallimento normale e riporta all'ultima fase, come per tutte le missioni.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { storyPanels } from './storykit.js';

function station(game) {
  if (M7._station?.game === game) return M7._station.value;
  const list = game.city?.stations || game.city?.hospitals || [];
  if (list.length) {
    let best = list[0];
    let d0 = Infinity;
    for (const s of list) {
      const d = dist(s.x, s.y, game.player.x, game.player.y);
      if (d < d0) { d0 = d; best = s; }
    }
    M7._station = { game, value: best };
    return best;
  }
  const fallback = {
    x: game.city?.w ? game.city.w * 0.64 : 9600,
    y: game.city?.h ? game.city.h * 0.32 : 7600,
    name: '종로',
  };
  M7._station = { game, value: fallback };
  return fallback;
}

function mapStation(ctx, id = 'm7-station') {
  const s = station(ctx.game);
  ctx.mark(s.x, s.y, { label: '경찰서 · 종로', route: true });
  ctx.dropMapPoint(id);
  ctx.mapPoint({ id, x: s.x, y: s.y, label: '경찰서 · 종로', color: '#5a8cff' });
  return s;
}

export const APERTURA = storyPanels('m7-open', [
  {
    palette: 4,
    hangul: '경찰서',
    title: 'La notte al commissariato',
    text: 'Insegna accesa, volanti in fila. Dentro una stanza senza radio aspetta un capocantiere.',
  },
  {
    palette: 4,
    hangul: '91.45',
    title: 'Kkachi resta in macchina',
    lines: [
      { who: '91.45', kkachi: true, text: '«Ti lascio qui.»' },
      { who: 'Jae-min', text: '«Non entri?»' },
      { who: '91.45', kkachi: true, text: '«Là dentro non c\'è una macchina accesa. Io sto dove c\'è una radio accesa.»' },
      { who: 'Jae-min', text: '«E se ti chiedessi di aspettarmi?»' },
      { who: '91.45', kkachi: true, text: '«Non me l\'ha mai chiesto nessuno.»' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m7-close', [
  {
    palette: 4,
    hangul: '06:10',
    title: 'All\'alba',
    text: 'Una busta con gli effetti personali. Dentro è rimasto solo l\'orologio.',
  },
  {
    palette: 4,
    hangul: '검은 차',
    title: 'La mano destra',
    text: 'Un\'auto nera lascia il cancello. Al finestrino posteriore, una mano destra resta in tasca.',
  },
  {
    palette: 4,
    hangul: '06:40',
    title: 'Cause naturali',
    lines: [
      { who: 'Narratore', text: 'Detenuto trovato morto in cella. Ore 06:40.' },
      { who: 'Narratore', text: 'Seo Jae-min è uscito da quel cancello alle 06:10.' },
      { note: true, text: 'Il telefono mostra la notizia alle nove del mattino.' },
    ],
  },
]);

export const M7 = {
  id: 'm7',
  title: 'Sei ore',
  hangul: '여섯 시간',
  act: 2,

  prepare(game) {
    if (!game.missions.flag('dulchae_alive')) game.missions.setFlag('dulchae_alive');
  },

  phases: [
    panelPhase('m7-apertura', APERTURA),
    {
      id: 'commissariato',
      hint: 'Raggiungi il commissariato di 종로',
      enter(ctx) {
        const s = mapStation(ctx);
        ctx.state.arrived = false;
        ctx.point({
          id: 'm7-arrive', key: 'E', text: 'entra nel commissariato', x: s.x, y: s.y, reach: 92,
          run: () => { ctx.drop('m7-arrive'); ctx.next(); },
        });
      },
      tick(_dt, ctx) {
        if (ctx.state.arrived) return;
        const s = station(ctx.game);
        if (dist(ctx.game.player.x, ctx.game.player.y, s.x, s.y) <= 86) ctx.state.arrived = true;
      },
    },
    {
      id: 'fatti-arrestare',
      hint: 'Metti via la pistola e fatti arrestare con una o due stelle',
      enter(ctx) {
        const s = mapStation(ctx);
        // Non si azzera su replay: quando `busted` ricostruisce questa fase il
        // callback già sa che l'arresto è avvenuto e può passare alla cella.
        ctx.state.bustHandled = !!ctx.state.bustHandled;
        ctx.point({
          id: 'm7-surrender', key: 'E', text: 'chiedi di essere fermato', x: s.x, y: s.y, reach: 92,
          run: () => {
            ctx.drop('m7-surrender');
            const game = ctx.game;
            if (game.player.weapon && game.player.weapon !== 'fists') {
              ctx.toast('Riponi la pistola: a mani vuote la polizia ti prende vivo', 3);
            }
            // Una rissa pesa poco per volta; ripeterla sette volte porta esatta-
            // mente alla prima stella senza usare campi privati di WantedSystem.
            if ((game.wanted?.level || 0) < 1) {
              for (let i = 0; i < 7; i++) game.wanted?.report?.('brawl', game);
            }
            ctx.talk([
              { who: 'Ha-eun', text: '«Una o due stelle. Niente pistola in mano. La polizia è il tuo ascensore.»' },
              { who: 'Ha-eun', text: '«E il giubbotto? Quello è già stato visto addosso a un altro.»' },
              { who: 'Jae-min', text: '«E se non mi prendono?»' },
              { who: 'Ha-eun', text: '«Ti mancano quattro ore.»' },
            ]);
          },
        });
        // Il callback viene installato dopo il punto: se il giocatore è già a
        // una stella, il sistema può arrestarlo nel frame seguente.
        ctx.on('busted', () => {
          if (ctx.state.bustHandled) return;
          ctx.state.bustHandled = true;
          ctx.next();
        });
      },
    },
    {
      id: 'cella',
      hint: '',
      enter(ctx) {
        ctx.unmark();
        ctx.dropMapPoint('m7-station');
        // Le sei ore sono già state fatte avanzare da bustPlayer. Nessun HUD e
        // nessuna radio: resta un punto discreto davanti al commissariato per
        // chiudere la scena anche se il motore non espone la cella come interno.
        const s = station(ctx.game);
        ctx.point({
          id: 'm7-byeon', key: 'E', text: 'ascolta il detenuto nella cella accanto', x: s.x, y: s.y, reach: 96,
          run: () => {
            ctx.drop('m7-byeon');
            ctx.talk([
              { who: 'Narratore', text: '변기태, capocantiere di 한성개발. Due operai morti nel crollo del 22 luglio.' },
              { who: 'Byeon', text: '«Lei era al cantiere. Il ventidue luglio. Con la cartellina.»' },
              { who: 'Jae-min', text: '«Non ero io.»' },
              { who: 'Byeon', text: '«Era lei. Ha firmato il verbale e ha detto ai ragazzi di scendere sotto il muro.»' },
              { who: 'Byeon', text: '«Una macchina nera, un autista. La mano destra in tasca, anche mentre firmava.»' },
              { note: true, text: 'Il ventidue luglio Jae-min era a Los Angeles. È atterrato il dieci agosto.' },
            ], () => ctx.next());
          },
        });
      },
    },
    panelPhase('m7-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m7_byeon_dead');
    game.missions.setFlag('m7_black_car');
    game.missions.setFlag('m7_jacket_other');
    if (!game.missions.flag('dulchae_alive')) game.missions.setFlag('dulchae_alive');
    game.hud.toast('여섯 시간 — completata', 3.2);
  },
};
