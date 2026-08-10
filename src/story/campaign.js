// La campagna: chi c'è, in che ordine, e da dove comincia.
//
// È l'unico file che conosce **tutte** le missioni. Il motore
// (`core/missions.js`) non ne conosce nessuna e una missione non conosce quella
// dopo: la catena sta qui, che è il posto in cui si legge in tre righe l'ordine
// dei dodici capitoli — e l'unico da cambiare quando ne arriva uno nuovo.
import { M1 } from './m1.js';
import { M2 } from './m2.js';
import { M3 } from './m3.js';
import { M4 } from './m4.js';
import { M5 } from './m5.js';
import { M6 } from './m6.js';
import { M7 } from './m7.js';
import { M8 } from './m8.js';
import { M9 } from './m9.js';
import { M10 } from './m10.js';
import { M11 } from './m11.js';
import { M12 } from './m12.js';
import { FINALS, startFinals } from './finals.js';
import { attachHospital } from './hospital.js';
import { findShop, freeSpot } from './places.js';

export const CAMPAGNA = [M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12];

/**
 * Cosa parte quando finisce cosa. Le missioni di questo atto si susseguono
 * direttamente; dalla tappa E in poi ce ne saranno che aspettano un'ora, un posto
 * o una chiamata di Kkachi, e allora la voce diventerà un predicato invece di un
 * id. Finché sono due, un id è la verità.
 */
export const DOPO = Object.fromEntries(
  CAMPAGNA.slice(0, -1).map((missione, i) => [missione.id, CAMPAGNA[i + 1].id]),
);

function attachStoryVisits(game) {
  // Le definizioni devono esistere già al caricamento: ActorSystem ripristina le
  // morti dopo `missions.restore`, ma può farlo soltanto per nomi registrati.
  const pawn = findShop(game, 'pawn', { district: 'hongdae', near: game.city.spawn });
  if (pawn) {
    game.actors.define('jo', {
      indoor: true, shop: pawn.id, level: pawn.level || 0,
      kind: 'civil', name: 'Jo Ok-bun', hangul: '조옥분', angle: Math.PI / 2,
      place: (floor) => (floor.till
        ? { x: floor.till.x - 26, y: floor.till.y - 20 }
        : freeSpot(floor)),
    });
  }
  game.actors.define('dulchae', {
    x: -1_000_000, y: -1_000_000, kind: 'gangster',
    name: 'Dulchae', hangul: '둘째', state: 'post',
  });
  game.storyShopActions ||= [];
  game.storyShopActions.push((shops, floor, current) => {
    const missions = current.missions;
    if (!missions.isDone('m6') || missions.flag('jo_lighter')) return;
    const def = current.actors?.defs?.get?.('jo');
    const active = shops.active;
    if (!def || def.dead || !active || active.shop.id !== def.shop
      || active.cur !== (def.level || 0)) return;
    const jo = current.actors.get('jo');
    if (!jo || jo.dead || Math.hypot(jo.x - current.player.x, jo.y - current.player.y) > 62) return;
    shops.actions.unshift({
      key: 'E',
      text: 'chiedi di 구만기 e del nome inciso sull’orologio',
      run: () => current.dialogue.play(current, [
        { who: 'Jae-min', text: '«구만기. Quel nome è inciso sul mio orologio. Nel libro del 1992 c’è un bambino.»' },
        { who: 'Jo', text: '«Adesso la domanda è giusta.»' },
        { who: 'Jo', text: '«Tuo padre lo impegnò il giorno che ti prese. Non tornò mai a riprenderlo.»' },
        { text: 'Jo gli mette in mano un accendino inciso. Pesa meno dell’orologio e dice la stessa cosa.' },
      ], () => {
        missions.setFlag('jo_lighter');
        missions.setFlag('jo_question');
        current.audio?.ui('ok');
        current.hud?.toast('Accendino inciso', 3);
      }),
    });
  });
}

export function registerCampaign(game) {
  for (const m of CAMPAGNA) game.missions.register(m);
  game.missions.register(FINALS);
  attachStoryVisits(game);
  // Il filo del 병원 non è una missione e non sta nella catena: si accumula per
  // conto suo a ogni morte, dalla prima all'ultima (`09-ospedale.md`).
  attachHospital(game);
  game.on('missionDone', (id) => {
    const next = DOPO[id];
    if (next) game.missions.start(next, game);
    else if (id === 'm12') startFinals(game);
  });
}

/**
 * Riprende anche i vecchi salvataggi che erano arrivati alla fine del contenuto
 * disponibile. `missions.restore` sa riaprire una fase attiva; qui si copre il
 * caso complementare: nessuna missione attiva, ma un capitolo appena concluso.
 */
export function resumeCampaign(game) {
  const missions = game.missions;
  if (missions.active || missions.flag('finaliVisti')) return false;
  if (missions.isDone('m12')) return startFinals(game);
  const next = CAMPAGNA.find((missione, i) => (
    !missions.isDone(missione.id)
    && (i === 0 || missions.isDone(CAMPAGNA[i - 1].id))
  ));
  return next ? missions.start(next.id, game) : false;
}

/**
 * Si comincia. Lo chiama `Game.playIntro` quando i ventotto pannelli dell'apertura
 * finiscono — saltati o guardati che siano — perché M1 **è** quello che viene
 * dopo l'apertura (`02-cutscene-iniziale.md`, «il passaggio di consegne»).
 *
 * Non lo chiama «Continua» né «Carica»: lì la storia è già a un certo punto, e a
 * rimetterla dov'era pensa `missions.restore` (`core/save.js`).
 */
export function beginCampaign(game) {
  game.missions.start('m1', game);
}
