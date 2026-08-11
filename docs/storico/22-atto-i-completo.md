# L'Atto I completo: M3, M4, R1, il pedinamento e i fogli

> §5.33 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.33 — La tappa E: il primo ribaltamento, messo in mano al giocatore

La tappa B aveva dato al motore le missioni; questa gli dà **un atto intero**. M3, M4 e il
raccordo R1 chiudono l'Atto I — dalla busta che scende in un parcheggio di Gangnam al referto
bagnato sul fondo di una barca — e con loro entrano le due meccaniche che il copione chiedeva da
due tappe: il **pedinamento con soglia di distanza** e l'**oggetto di missione trasportabile**.

Il criterio è quello di sempre: quello che vale per più di una missione sta nel motore, quello
che sa la trama sta sotto `src/story/`.

---

## 1. Il pedinamento (`core/tail.js`)

Una regola con **due capi**: troppo lontano e lo perdi, troppo vicino e ti vede. In mezzo c'è una
fascia larga in cui non succede niente, ed è dove il giocatore deve imparare a stare — per questo
l'indicatore non è una barra che si riempie ma **un cursore fra due bordi rossi**: dice da che
parte stai sbagliando prima di dire quanto.

Due decisioni che sembrano dettagli e non lo sono:

- **niente si azzera di colpo.** Uscire dalla fascia riempie un serbatoio e rientrare lo svuota,
  al doppio della velocità. Un semaforo perso non fa fallire una scena da quattro minuti;
- **quello che ti fa notare non è solo la distanza.** I fari accesi di notte, la lamiera toccata
  e le sirene addosso pesano quanto stargli sotto il paraurti, e sono le tre cose che un
  giocatore fa senza accorgersene. L'indicatore le nomina, perché un fallimento che non si vede
  a schermo sembra un bug.

Il sistema **non decide cosa vuol dire fallire**: alza i due serbatoi e manda `tailLost` o
`tailSpotted` sul bus. In M3 «l'hai perso» rimette la fase; in M9 potrebbe non essere nemmeno un
fallimento.

**Perché serviva un'auto che arriva.** Il traffico sceglie a caso a ogni incrocio (§5.10): nessuno
di quei guidatori sta andando da qualche parte, e un pedinamento dietro a uno che gira a caso non
è una scena. Adesso `traffic.spawnScripted` mette in strada un'auto della storia e
`traffic.sendTo` le dà **una fila di incroci** — lo stesso A* che disegna l'itinerario sulla carta
(§5.30), calcolato una volta alla partenza. Da lì l'auto non cerca più niente: a ogni incrocio
prende l'arco che porta al nodo dopo. Tutto il resto del traffico continua a valere per lei —
semafori, distanza di sicurezza, code — ed è quello che la fa sembrare un'auto e non un binario.

## 2. L'oggetto trasportabile (`core/carry.js`)

I tre pegni di M2 erano tre caselle in un taccuino: non si vedevano addosso e non si potevano
perdere. Va bene per una lista della spesa e non va bene per i **due fogli del molo 7**, che sono
la prova su cui gira l'atto e che si attraversa mezzo porto con addosso, sotto tiro.

La differenza è tutta in una riga: **un oggetto trasportabile si perde.** Morire o farsi
arrestare lo lascia per terra dov'eri — non lo confisca nessuno, la divisa prende l'arsenale
(§5.16) e non un registro di carico — e non svanisce mai: sparire sarebbe un fallimento senza un
posto dove andare a rimediare. Il punto in cui cade **non** è quello che ha il giocatore quando
arriva `respawn`: lì è già in corsia. È l'ultimo punto buono in cui è stato visto, che il sistema
tiene aggiornato a ogni frame per quella riga sola.

Ce n'è **uno per volta**, come il blip e come il pedinamento: due vorrebbero dire un inventario, e
questo gioco non ne ha uno. Sta nel salvataggio (v6, due campi) e l'HUD lo scrive sotto il titolo
della missione, non in un riquadro suo — fuori da una missione non se ne porta nessuno.

## 3. Tre cose che il motore non aveva

**L'appuntamento** (`ctx.waitUntil`). Il copione fa cominciare M3 alle `03:20` e M6 alle `14:00`,
e la decisione presa con l'utente è che il blip porti **dove si aspetta**, non dove si comincia.
Chi arriva all'incrocio alle tre del pomeriggio non può stare dodici minuti veri a guardare
l'orologio: si mette lì e passa la notte. L'orologio si fa **girare**, non si sposta
(`dayCycle.advance`), o il meteo all'alba sarebbe quello di mezzanotte — e la tendina nera è
quella del futon, che è già il modo in cui questo gioco dice «sono passate delle ore».

**L'inquadratura tenuta da una scena** (`camera.holdZoom`). Dalla cima della gru di M4 si deve
vedere quanto è grande il porto. Una quota percorribile non c'è e non è questa la tappa che la
aggiunge, ma la camera sa allargarsi — solo che **il giocatore riscrive il bersaglio a ogni
frame** (`player.update`), quindi senza un blocco una missione non tiene un'inquadratura nemmeno
per mezzo secondo.

**La morte per copione** (`actors.die`). Oh Se-jung cade a metà della sparatoria e deve cadere
anche se in quel momento non è a schermo: il suo pedone può essere stato despawnato mentre eri
dall'altra parte del piazzale, e una morte che dipende da dove guardi non è una morte.

## 4. Le due missioni e il raccordo

**M3 · «Il turno di notte»** — dieci fasi, cinque pannelli. Un appuntamento alle quattro davanti a
un 편의점 di Itaewon sotto l'acqua, due auto che non si incontrano mai, e un pedinamento a fari
spenti fino a una torre di vetro di Gangnam. Dice **il fatto dell'Atto I** e lo dice piano: il
백호파 non riscuote da 한성개발, la paga. Perderla non è un game over — il giro si ripete il
martedì e il venerdì, quindi la berlina ripassa.

**E il volume scende davvero.** Quando Kkachi dice «abbassa», il gioco abbassa la manopola vera
del mixer — quella della radio e quella della musica — e **non la rialza**. È il pezzo di
`00-soggetto.md` §6, ed è l'unica scena in cui stare zitti *è* la meccanica.

**M4 · «Molo 7»** — otto fasi, dieci pannelli. Il registro della gru, l'agguato fra i container,
la gru, la barca e le motovedette. Oh Se-jung muore male e **il gioco non fa un pannello**: si
sente e basta (regola di tono — non aggiungerlo). La chiusura è il primo ribaltamento: `171 cm` su
un referto, e una fotografia che non è specchiata come quella del funerale.

**R1 · «Il tè freddo»** — una fase e tre pannelli, ed è **una missione come le altre**: un
raccordo con un impianto suo sarebbe un secondo motore da mantenere per quattro scene. Quello che
fa sta in una parola: Chun-sik dice «dice» invece di «diceva», e non lo corregge nessuno.

Due personaggi nuovi a pixel: **Yoon Ha-eun** (i capelli raccolti sono la sua faccia: la crocchia
esce dal profilo, ed è l'unica sagoma del cast che sborda dalla testa) e **Oh Se-jung** (i baffi
grigi, su una riga che le espressioni non riscrivono).

## 5. La continuità della cicatrice

Il copione di M4 dice che nel ritratto del funerale la cicatrice sta a sinistra. **A schermo sta a
destra** dal §5.28, ed è scritto nella griglia di `pixelkit` che quella stampa è la specchiata.
Il pannello e il narratore dicono quello che si vede — sinistra e destra scambiate rispetto al
copione — perché l'indizio deve reggere per chi *guarda*, e la cutscene iniziale è già a schermo
da due tappe. Chi tocca `m4-7` guardi il pannello 11 dell'apertura prima di girare un `flip`.

---

## Quello che questa tappa ha trovato a schermo, e non nel sorgente

- **Le figure finivano sotto il riquadro delle battute.** Ha-eun, Oh Se-jung e tutti e due i
  personaggi di R1 erano disegnati a figura intera con i piedi in fondo al pannello: il gradiente
  del testo si prende il terzo basso, e di loro non si vedeva un pixel. Un pannello con tre
  battute ha spazio per una faccia **sopra**, e per niente altro.
- **Il riquadro delle battute può uscire dal pannello.** Cinque voci di Kkachi in una tavola sola
  e la prima riga finiva **oltre il bordo di sopra**. La regola scritta in `08-domande-aperte.md`
  vale davvero: se un pannello risulta pieno di testo si taglia la battuta — o, come qui, si
  divide in due tavole, e il fruscio di tre secondi diventa il pannello quasi vuoto che il
  copione voleva.
- **La condensa era sotto il finestrino.** Un velo chiaro messo a occhio «lì vicino» al vetro di
  `car()` non è un vetro appannato: è un vetro rotto con un pezzo di compensato al posto suo. La
  finestra va calcolata dagli stessi numeri che usa `car()`.
- **Una nuca senza spalle è un vaso.** `figure(..., 'back')` con un `crop` corto disegna la sola
  sagoma dei capelli, e a schermo sembra un oggetto sul tavolo.
- **Di notte una gru scura sparisce.** Sul piazzale del porto i tralicci vanno **più chiari** del
  fondo, non più scuri.
- **Un minimarket senza scaffali è un manifesto.** Un rettangolo chiaro appeso a un muro non è una
  vetrina: servono la fascia dell'insegna sopra il vetro, i montanti, e qualcosa di scuro dentro.

E quattro difetti che **solo la scena di prova poteva vedere**, perché nel sorgente sono corretti:

- **`ai.arrived` sopravvive alla fase.** La berlina che ritira la busta arriva *al minimarket*,
  quindi il pedinamento la trovava già «arrivata» e finiva nel frame in cui cominciava.
- **Un agguato che nasce quando la fase comincia non c'è quando arrivi.** Morire mandava sei
  uomini a presidiare un piazzale vuoto: lo streaming se li portava via mentre eri in corsia, e al
  ritorno la sparatoria si chiudeva da sola senza che tu avessi sparato un colpo. Adesso nasce
  quando ci sei, e si mette in pausa quando ti allontani.
- **Una lamiera toccata dal traffico non è una lamiera toccata da te.** Con `hp < maxHp` il
  pedinamento saltava per un tamponamento fra due estranei dall'altra parte dell'incrocio.
- **Il giocatore riscrive lo zoom a ogni frame**, quindi la camera della gru durava un frame.

## Poggia su

Impianto delle missioni, fasi, blip e ripresa (§5.29) · itinerario sulla carta e A* sul grafo
(§5.30) · 까치 e la `91.45` (§5.32) · guida AI del traffico (§5.10) · orologio, pioggia e frenata
sul bagnato (§5.11) · porto, moli e barche (§5.9) · motovedette ed elicottero (§5.5) · risveglio
in corsia (§5.16) · pannelli, `panelkit` e `pixelkit` (§5.28).

## Chiederebbe

- **Una quota percorribile**, che è l'unica cosa del copione di M4 che non si è potuta fare: sulla
  gru non ci si sale, ci si arriva sotto.
- **Una risposta diversa da Jo dopo M6** (le «visite che cambiano»), rimasta indietro dalla B.
- **Un secondo oggetto trasportabile insieme al primo**, il giorno che una missione ne chiederà
  due: oggi è uno, e per M4 basta.
