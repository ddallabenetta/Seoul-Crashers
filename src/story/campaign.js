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
import { R1 } from './r1.js';
import { attachHospital } from './hospital.js';
import { attachKkachi } from './kkachi.js';

const CAMPAGNA = [M1, M2, M3, M4, R1];

/**
 * Cosa parte quando finisce cosa. **L'Atto I si susseguono tutte e cinque**, e
 * l'ora di appuntamento non è un'eccezione a questa fila: M3 comincia quando
 * finisce M2 e poi *aspetta le quattro* dentro di sé (`ctx.waitUntil`), che è la
 * decisione 3 di `storia/08-domande-aperte.md` — il blip porta dove si aspetta,
 * l'ora la dice il pannello.
 *
 * Il raccordo R1 sta in questa tabella come le missioni: è una missione con una
 * fase sola e tre pannelli, e fare altrimenti vorrebbe dire un secondo impianto
 * per quattro scene.
 */
const DOPO = { m1: 'm2', m2: 'm3', m3: 'm4', m4: 'r1' };

export function registerCampaign(game) {
  for (const m of CAMPAGNA) game.missions.register(m);
  // Il filo del 병원 non è una missione e non sta nella catena: si accumula per
  // conto suo a ogni morte, dalla prima all'ultima (`09-ospedale.md`).
  attachHospital(game);
  // E nemmeno 까치: le sue ventiquattro chiamate non sono missioni e non hanno un
  // ordine: sono una tabella di predicati che guarda il mondo (`07-radio-kkachi.md`).
  attachKkachi(game);
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
