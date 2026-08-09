// In che modalità sta girando il gioco, in un posto solo.
//
// Prima di questo file lo dicevano dieci booleani sparsi — `started`, `paused`,
// `indoors`, `menu.open`, `mapView.open`, `shopMenu.open`, `metro.open`,
// `startMenu.open`, `shops.active`, `metro.inside` — e `paused` era una riga di
// `main.update` che ne metteva quattro in `or`. Ha retto finché le modalità erano
// due e mezzo: si gioca, c'è un pannello davanti, si guarda il titolo.
//
// Le modalità che serviranno non sono nessuna delle tre. Un dialogo di missione
// vuole il mondo fermo (come un menu), il giocatore fermo (come un menu) e
// **qualcosa che anima lo stesso** (come il gioco); una cutscene a pannelli lo
// stesso, con un ducking suo. Scritte a booleani sarebbero state la quinta e la
// sesta condizione di una riga che ne aveva già quattro, **più un ramo in ognuno
// dei posti che leggono `game.paused`** — e quelli non sono in questo file.
//
// Qui invece ogni modalità **dichiara cosa concede**, e chi deve saperlo lo chiede
// a `game.mode` invece di ricostruirlo. Aggiungerne una è una riga in questa
// tabella.
//
// Non è una pila: l'ordine di questa lista *è* la priorità, e per adesso le
// modalità non si sovrappongono (non si apre la mappa dentro un dialogo).
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
    // I pannelli: il mondo è fermo come in un menu, ma qualcosa anima lo stesso.
    // Il mondo si abbassa quasi a zero (là fuori non c'è niente che stia
    // succedendo) e la radio tace del tutto — sotto la scena suona il suo tema.
    id: 'cutscene',
    when: (game) => !!game.cutscene?.active,
    worldRuns: false, playerRuns: false, duck: 0.12, radioDuck: 0, cursor: 'default',
  },
  {
    // Il dialogo di missione: era **l'esempio** con cui questa tabella era stata
    // scritta, e adesso esiste (`ui/dialogue.js`). Mondo fermo e giocatore fermo
    // come in un menu, ma la città resta a schermo sotto il riquadro — quindi si
    // abbassa meno di una cutscene, che invece il mondo lo copre del tutto. La
    // radio scende a metà e non a zero: due battute non valgono uno stacco.
    id: 'dialogue',
    when: (game) => !!game.dialogue?.active,
    worldRuns: false, playerRuns: false, duck: 0.4, radioDuck: 0.5, cursor: 'default',
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
