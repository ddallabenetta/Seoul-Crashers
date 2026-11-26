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
import { M5 } from './m5.js';
import { M6 } from './m6.js';
import { R2 } from './r2.js';
import { M7 } from './m7.js';
import { M8 } from './m8.js';
import { R3 } from './r3.js';
import { M9 } from './m9.js';
import { M10 } from './m10.js';
import { attachHospital } from './hospital.js';
import { attachKkachi } from './kkachi.js';
import { attachVisite } from './visite.js';

const CAMPAGNA = [M1, M2, M3, M4, R1, M5, M6, R2, M7, M8, R3, M9, M10];

/**
 * Cosa parte quando finisce cosa. **L'Atto I si susseguono tutte e cinque**, e
 * l'ora di appuntamento non è un'eccezione a questa fila: M3 comincia quando
 * finisce M2 e poi *aspetta le quattro* dentro di sé (`ctx.waitUntil`), che è la
 * decisione 3 di `storia/08-domande-aperte.md` — il blip porta dove si aspetta,
 * l'ora la dice il pannello.
 *
 * **L'Atto II comincia dove l'Atto I finisce** (`r1` → `m5`) e finisce con R3, dopo M7 e
 * M8 (tappa T8, §5.42). L'Atto III comincia da M9, e la catena si allunga con una riga.
 *
 * Il raccordo R1 sta in questa tabella come le missioni: è una missione con una
 * fase sola e tre pannelli, e fare altrimenti vorrebbe dire un secondo impianto
 * per quattro scene.
 */
const DOPO = { m1: 'm2', m2: 'm3', m3: 'm4', m4: 'r1', r1: 'm5', m5: 'm6', m6: 'r2', r2: 'm7', m7: 'm8', m8: 'r3', r3: 'm9', m9: 'm10' };

export function registerCampaign(game) {
  for (const m of CAMPAGNA) game.missions.register(m);
  // Il filo del 병원 non è una missione e non sta nella catena: si accumula per
  // conto suo a ogni morte, dalla prima all'ultima (`09-ospedale.md`).
  attachHospital(game);
  // E nemmeno 까치: le sue ventiquattro chiamate non sono missioni e non hanno un
  // ordine: sono una tabella di predicati che guarda il mondo (`07-radio-kkachi.md`).
  attachKkachi(game);
  // Le «visite che cambiano» non sono missioni e non hanno un ordine: un personaggio
  // che c'è sempre e risponde in modo diverso (`07-radio-kkachi.md`).
  attachVisite(game);
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
