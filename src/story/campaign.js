// La campagna: chi c'è, in che ordine, e da dove comincia.
//
// È l'unico file che conosce **tutte** le missioni. Il motore
// (`core/missions.js`) non ne conosce nessuna e una missione non conosce quella
// dopo: la catena sta qui, che è il posto in cui si legge in tre righe l'ordine
// dei dodici capitoli — e l'unico da cambiare quando ne arriva uno nuovo.
import { M1 } from './m1.js';
import { M2 } from './m2.js';
import { attachHospital } from './hospital.js';

const CAMPAGNA = [M1, M2];

/**
 * Cosa parte quando finisce cosa. Le missioni di questo atto si susseguono
 * direttamente; dalla tappa E in poi ce ne saranno che aspettano un'ora, un posto
 * o una chiamata di Kkachi, e allora la voce diventerà un predicato invece di un
 * id. Finché sono due, un id è la verità.
 */
const DOPO = { m1: 'm2' };

export function registerCampaign(game) {
  for (const m of CAMPAGNA) game.missions.register(m);
  // Il filo del 병원 non è una missione e non sta nella catena: si accumula per
  // conto suo a ogni morte, dalla prima all'ultima (`09-ospedale.md`).
  attachHospital(game);
  game.on('missionDone', (id) => {
    const next = DOPO[id];
    if (next) game.missions.start(next, game);
  });
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
