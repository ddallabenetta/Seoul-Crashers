# Engine e prestazioni: misurare per sistema, toccare solo dove si vede

> §5.45 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> La tabella delle modalità: [§5.27](16-impianto-della-campagna.md).

### 5.45 — Tappa T4 del rework: una misura onesta, quattro risparmi e tre rami in meno

La tappa era stata concordata come **«misura per sistema, poi solo dove si vede»**, e non come una
caccia ai millisecondi. Il gioco gira a 60 fps sulle macchine vere: lo scopo era sapere **dove**
va il tempo di un frame, così che le tappe dei contenuti (Atto III, finali, corridoio) non lo
spendano alla cieca. I risparmi fatti sono quelli che la misura ha indicato e che non cambiano
un pixel a schermo.

---

## 1. La misura: `costo.scene`

Quattro scenari fissi: `centro` (Seoul di giorno, a piedi), `inseguimento` (in auto con le
stelle), `notte` (temporale) e `busan`. Sono ripetibili perché la scena **ferma il loop vero e
guida i frame a mano** (`update(1/60)` + `render()`), sostituisce `Math.random` con un LCG a
seme fisso e blocca ora e meteo. Ogni metodo interessante è avvolto da un cronometro, e per ogni
voce si prende **il miglior blocco da 100 frame** dopo 240 di riscaldamento: il carico della
macchina sporca la media, il minimo regge.

Cosa **non** è: è tempo di JS in headless con rasterizzazione software, dove il disegno su
canvas costa molto più che su una GPU. Serve a confrontare prima e dopo, mai a prevedere i fps
di una macchina vera. Confronto onesto: due alberi, run in coppia contemporanea, almeno tre
coppie. `performance.now()` ha risoluzione di 100 µs, quindi reggono le somme su centinaia di
frame e non il frame singolo.

## 2. Quello che la misura ha indicato

- **`SpatialGrid.queryRect`** era la voce più alta di JS puro. Deduplicava i risultati con una
  `Map` oggetto→query, scritta per ogni oggetto di ogni query. Adesso la deduplica è un intero
  sull'oggetto (`_gq`), con un contatore unico per tutte le griglie, perché un edificio sta sia
  in `buildingGrid` sia in `solidGrid`. Le griglie di soli punti (veicoli e pedoni, rifatte a
  ogni frame) non deduplicano affatto, perché un punto sta in una cella sola. L'ordine dei
  risultati non cambia, quindi non cambia niente che dipenda dall'ordine.
- **La fila di profondità della scena** (`render/scene.js`) creava qualche centinaio di
  letterali `{t,o,d}` a ogni frame: adesso le voci si riusano da un pool (`_pool`, `entry`).
- **Le macchie a terra** (`fx.drawDecals`) facevano save/translate/rotate/restore anche a mille
  pixel dallo schermo, e dopo un inseguimento le tracce di gomma sono centinaia: adesso si
  saltano quelle fuori dal rettangolo inquadrato, con un margine pari alla loro diagonale.
- **`won()`** chiamava `toLocaleString` a ogni frame con lo stesso numero, per l'HUD: una cache
  piccola, svuotata sopra 512 voci.

### Quanto si è guadagnato

Tre coppie in parallelo, albero prima di T4 contro albero dopo (che contiene anche G1 e la correzione delle
guardie: di G1 nel disegno c'è solo il velo della nebbia, che fuori da M9 è spento), mediana delle tre, ms di JS per frame:

| Scenario | `update` totale | `render.scena` | Nota |
| --- | --- | --- | --- |
| centro | 0,67 → 0,61 | 11,4 → 12,4 | il disegno oscilla di ±1 ms fra coppie: pari |
| inseguimento | 0,84 → 0,81 | 18,6 → 16,8 | è qui che le macchie fuori campo pesano: −1,7 ms |
| notte | 0,37 → 0,37 | 14,4 → 12,3 | una coppia su tre rumorosa (19 contro 12) |

**Il guadagno è piccolo**, e onestamente fuori dal rumore solo nell'inseguimento. Era quello che la misura
diceva prima di toccare niente: il JS della simulazione sta sotto il millisecondo, e il resto è disegno su
canvas, che in headless costa molto più che su una GPU. Lo scenario `busan` in due coppie su tre aveva
misurato una modalità diversa da `play` per un blocco intero (tutto a zero): la scena adesso scrive `modi`, il
conto dei frame per modalità, e un risultato vale solo se è `play: 800`.

## 3. Tre rami in meno in `main.js`

`main.update` aveva tre rami scritti a mano (cutscene, titolo, dialogo) e `main.render` due. Ora
la tabella delle modalità (`core/modes.js`, §5.27) ha tre campi facoltativi:

- `step(game, dt)`: la modalità si prende tutto l'update, e chiude da sé il frame;
- `frame(game, ctx)`: si prende tutto il disegno, senza la città sotto (i pannelli);
- `overlay(game, ctx)`: la città si disegna e poi si disegna questo al posto di HUD e pannelli
  (il titolo).

Una modalità senza questi campi gira come il gioco. Aggiungerne una nuova che si prende il
frame, come i titoli di coda della tappa H, è quindi una riga in tabella e non un `if` in più.

## 4. Cose da sapere

- **La misura non è in CI.** Si lancia a mano quando una tappa aggiunge qualcosa che gira a ogni
  frame, e si confronta con l'albero di prima.
- **I veli a schermo intero** (luce, pioggia) restano non misurabili onestamente in headless,
  come già detto in §5.11.
