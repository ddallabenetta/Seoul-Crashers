// In che modalità sta girando il gioco, in un posto solo.
//
// Prima di questo file lo dicevano dieci booleani sparsi — `started`, `paused`,
// `indoors`, `menu.open`, `mapView.open`, `shopMenu.open`, `metro.open`,
// `startMenu.open`, `shops.active`, `metro.inside` — e `paused` era una riga di
// `main.update` che ne metteva quattro in `or`. Ha retto finché le modalità erano
// due e mezzo: si gioca, c'è un pannello davanti, si guarda il titolo.
//
// La cutscene è la prima che non è nessuna delle tre. Vuole il mondo fermo (come
// un menu), il giocatore fermo (come un menu), **i pannelli che animano** (come il
// gioco) e un abbassamento dell'audio suo. Scritta a booleani sarebbe stata la
// quinta condizione di una riga che ne aveva già quattro, più un ramo in ognuno
// dei posti che leggono `game.paused`.
//
// Qui invece ogni modalità **dichiara cosa concede**, e chi deve saperlo lo chiede
// a `game.mode` invece di ricostruirlo. Aggiungerne una è una riga in questa
// tabella; le missioni ne porteranno almeno altre due (dialogo, fallimento).
//
// Non è ancora una pila: l'ordine di questa lista *è* la priorità, e per adesso le
// modalità non si sovrappongono davvero (non si apre la mappa dentro una cutscene).
// Diventerà una pila il giorno che due si sovrappongono per davvero, e quel giorno
// cambia questo file e nient'altro.

/**
 * - `worldRuns`  il mondo avanza (traffico, pedoni, polizia, orologio)
 * - `playerRuns` il giocatore risponde ai comandi
 * - `duck`       moltiplicatore dei letti audio del mondo
 * - `radioDuck`  moltiplicatore della radio — separato apposta: la radio è la
 *                musica che ha scelto il giocatore e si abbassa meno del mondo
 * - `cursor`     il puntatore del mouse si vede o no
 */
export const MODES = [
  {
    id: 'cutscene',
    when: (game) => !!game.cutscene?.active,
    worldRuns: false, playerRuns: false, duck: 0.12, radioDuck: 0, cursor: 'default',
  },
  {
    // Il titolo: il mondo gira eccome (è l'attract mode), il giocatore no.
    id: 'title',
    when: (game) => !game.started,
    worldRuns: true, playerRuns: false, duck: 1, radioDuck: 1, cursor: 'default',
  },
  {
    id: 'menu',
    when: (game) => !!(game.menu?.open || game.mapView?.open || game.shopMenu?.open || game.metro?.open),
    worldRuns: false, playerRuns: false, duck: 0.22, radioDuck: 0.4, cursor: 'default',
  },
  {
    id: 'play',
    when: () => true,
    worldRuns: true, playerRuns: true, duck: 1, radioDuck: 1, cursor: 'none',
  },
];

const PLAY = MODES[MODES.length - 1];

export function resolveMode(game) {
  for (const m of MODES) if (m.when(game)) return m;
  return PLAY;
}
