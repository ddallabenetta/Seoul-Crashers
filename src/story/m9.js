// M9 · «Gyeongbu» — 경부
//
// L'Atto III apre la mappa unica: questa missione è volutamente compatta, ma
// conserva i tre movimenti del copione (strada, confessione, ingresso a Busan).
// Le destinazioni sono landmark reali della Corea generata, quindi il blip e la
// rotta della minimappa funzionano anche quando la seed sceglie un edificio
// diverso da quello che si vede nel copione.
import { panelPhase } from '../core/missions.js';
import { interactPhase, travelPhase } from './storykit.js';
import { storyPanels } from './storykit.js';

function area(game, id) {
  return game.city?.areas?.find((a) => a.id === id) || null;
}

function landmark(game, id, fallbackArea = 'busan', u = 0.5, v = 0.5) {
  const lm = game.city?.landmarks?.find((item) => item.id === id);
  if (lm) return { x: lm.x, y: lm.y };
  const a = area(game, fallbackArea);
  if (a) return { x: a.x0 + a.city.w * u, y: a.y0 + a.city.h * v };
  return { x: game.player.x, y: game.player.y };
}

export const APERTURA = storyPanels('m9-apertura', [
  {
    title: '05:10 · 경부고속도로',
    text: 'Il piazzale di un’area di servizio all’uscita di Seoul. Due caffè sul tetto dell’auto.',
    hangul: '경부',
    palette: 3,
    lines: [
      { who: 'Chun-sik', text: '«Guidi tu?»' },
      { who: 'Jae-min', text: '«Dimmela adesso.»' },
      { who: 'Chun-sik', text: '«Quattrocento chilometri. Sei ore. Alla fine ti dico una cosa e mi lasci a Busan. Adesso guidi.»' },
    ],
  },
  {
    title: 'La nebbia',
    text: 'La strada davanti è vuota e dritta. Le risaie passano sotto una luce bassa.',
    hangul: '휴게소',
    palette: 0,
    lines: [
      { who: 'Chun-sik', text: '«Trent’anni fa qui c’era un quartiere. Non c’erano i semafori, e tutti sapevano dove abitavi.»' },
      { who: 'Jae-min', text: '«Tu non ti metti mai la cintura.»' },
      { who: 'Chun-sik', text: '«Oggi faccio un’eccezione.»' },
    ],
  },
  {
    title: 'Il convoglio',
    text: 'Tre furgoni Hanseong e una scorta. Il parabrezza si crepa; la voce continua.',
    hangul: '한성개발',
    palette: 4,
    lines: [
      { who: 'Chun-sik', text: '«L’ho consegnato io, tuo padre. A loro. Dodici anni fa.»' },
      { who: 'Jae-min', text: '«Quanto ti hanno dato?»' },
      { who: 'Chun-sik', text: '«Niente. Me lo ha chiesto lui, in un parcheggio a Gimpo. Ho detto di no per due ore, poi sì.»', note: 'La confessione arriva a duecento all’ora, senza musica.' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m9-chiusura', [
  {
    title: 'Busan',
    text: 'La baia, il ponte, le gru del porto. Seoul è già piccola nello specchietto.',
    hangul: '부산',
    palette: 0,
  },
  {
    title: '서면',
    text: 'Chun-sik scende con la sua borsa e resta in piedi, senza entrare da nessuna parte.',
    hangul: '서면',
    palette: 2,
    lines: [
      { who: 'Jae-min', text: '«Chi devi vedere?»' },
      { who: 'Chun-sik', text: '«Nessuno. Ti ho chiesto io di portarmi via da Seoul.»' },
    ],
  },
  {
    title: 'Lo specchietto',
    text: 'L’auto riparte. Chun-sik diventa piccolo e non si muove.',
    hangul: '05:10',
    palette: 3,
  },
]);

const confession = [
  { who: 'Chun-sik', text: '«L’ho consegnato io, tuo padre. A loro. Dodici anni fa.»' },
  { who: 'Jae-min', text: '«E quanto mi hanno dato?»' },
  { who: 'Chun-sik', text: '«Niente. Non ho preso niente, ragazzo.»' },
  { who: 'Chun-sik', text: '«Me lo ha chiesto lui. Parcheggio a Gimpo, macchina accesa. Lasciavano stare il quartiere finché lui restava sparito.»' },
  { who: 'Jae-min', text: '«E la gente cosa ha capito?»' },
  { who: 'Chun-sik', text: '«Che ho venduto il mio capo. A spiegarlo il patto si rompeva: ha tenuto in piedi tremila persone per dodici anni.»' },
  { who: 'Jae-min', text: '«Perché me lo dici adesso?»' },
  { who: 'Chun-sik', text: '«Perché i dodici anni sono finiti martedì. E perché tu mi credi una carogna, e io ti ho tenuto in braccio.»' },
];

export const M9 = {
  id: 'm9',
  title: 'Gyeongbu',
  hangul: '경부',
  act: 3,

  prepare(game) {
    // Il finale C deve poter distinguere un Dulchae già morto da uno ancora in
    // scena. Se un atto precedente ha già scritto il fatto, non lo sovrascriviamo.
    const m = game.missions;
    const dead = m.flag('dulchaeDead') || m.flag('dulchae_dead') || game.actors?.isDead?.('dulchae');
    const alive = m.flag('dulchaeAlive') || m.flag('dulchae_alive');
    if (!dead && !alive) {
      m.setFlag('dulchaeAlive');
      m.setFlag('dulchae_alive');
    }
  },

  phases: [
    panelPhase('m9-apertura', APERTURA),

    travelPhase('m9-gyeongbu', 'Guida sulla Gyeongbu fino a Busan', (game) => landmark(game, 'busan-tower'), {
      label: '부산 · Busan',
      route: true,
    }),

    {
      id: 'm9-confessione',
      hint: 'Affianca il convoglio e ascolta Chun-sik',
      enter(ctx) {
        const site = landmark(ctx.game, 'busan-tower');
        ctx.mark(site.x, site.y, { label: 'posto di blocco · 부산', route: true });
        ctx.mapPoint({ id: 'm9-checkpoint', ...site, label: 'posto di blocco · 부산', color: '#e8595e' });
        ctx.point({
          id: 'm9-confessione', x: site.x, y: site.y, key: 'E', reach: 120,
          text: 'ascolta la confessione di Chun-sik',
          onFoot: false,
          run: () => {
            ctx.drop('m9-confessione');
            ctx.unmark();
            ctx.talk(confession, () => ctx.next());
          },
        });
      },
    },

    interactPhase('m9-checkpoint', 'Passa il blocco all’ingresso di Busan', (game) => landmark(game, 'busan-tower'),
      'passa il posto di blocco', [
        { who: 'Chun-sik', text: '«Non fermarti. A Busan lasciami a 서면.»' },
        { who: 'Jae-min', text: '«E poi?»' },
        { who: 'Chun-sik', text: '«Poi fai quello che sei venuto a fare.»' },
      ], { label: 'posto di blocco · 부산', reach: 120 }),

    panelPhase('m9-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m9');
    game.missions.setFlag('chunsikConfession');
    game.hud?.toast('경부 — completata', 3.2);
  },
};

export default M9;
