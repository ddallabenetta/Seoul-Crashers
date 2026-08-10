# §5.32 — 까치 sulla `91.45`

> Storico. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).
> Il copione: [`docs/storia/07-radio-kkachi.md`](../storia/07-radio-kkachi.md).

### 5.32 Tappa D della campagna: la stazione, la tabella con predicato, l'Atto I

La quarta tappa del §6.0, e la prima che aggiunge una **voce** invece di un sistema. Il gioco
aveva già una radio con dentro stazioni coreane vere (§5.14); adesso in cima alla manopola c'è
una stazione che non trasmette niente e parla soltanto a te.

**Cosa c'è dentro.** La stazione `91.45`, il motore che sceglie cosa dire, le **otto chiamate
dell'Atto I**, le **dodici righe di salita in macchina** più le quattro di servizio (la cella, il
motore acceso da due minuti, la rete che non c'è, il cortile che ti hanno portato via), e le tre
battute di trama che dal §5.29 stavano appese a un `hud.toast` in attesa di questo file.

---

#### La stazione non è uno stream, ed è il punto

`91.45` è una riga di `radio.stations` con `url: null`. Non apre una connessione, non può essere
lenta, non può essere muta e **non può rompersi** — le tre cose che possono succedere a tutte le
altre. Da qui scendono tre conseguenze che valgono più della riga:

- **la radio si accende sempre su 까치**, e quindi il gioco adesso non manda un pacchetto a
  nessuno finché non si preme `R` la *seconda* volta. Il §5.14 aveva scritto «non parla con la
  rete finché non la accendi»; adesso è «finché non la accendi e non te ne vai da lì»;
- **quando la rete non c'è, la radio non si spegne più.** Prima l'elenco vuoto la mandava in
  `off`; adesso resta accesa su 까치 e a dirlo è lui («Stanotte la città è muta»);
- **`fail()` non la tocca.** Staccare la sorgente da un `<audio>` fa scattare un `error` da solo,
  quindi passare da una stazione vera a 까치 ne generava uno: senza la guardia, la frequenza si
  sarebbe segnata rotta e sarebbe sparita dalla manopola per il resto della partita.

Quello che si sente su quella frequenza è un **letto di fruscio** (`audio.beds.kkachi`, rumore
bianco in banda stretta) più uno scatto di portante in apertura e in chiusura
(`audio.squelch`). Sale nei silenzi e scende sotto le battute: è la ragione per cui i silenzi
scritti nel copione — «sette secondi di fruscio», «quattro secondi» — adesso esistono. I
pannelli sono muti per decisione (`08-domande-aperte.md`, punto 1) e questo è tutto quello che
Kkachi ha al posto di una voce.

#### Una tabella con predicato, non un innesco

La decisione era già presa (punto 9): «come `WEAPONS` o `BUSINESSES`, ogni riga è una chiamata
con la sua condizione». `core/kkachi.js` fa girare la tabella e **non conosce nessuna battuta**;
`story/kkachi.js` contiene le righe e **non sa come vengono scelte**. È la stessa divisione di
`core/missions.js` / `story/m1.js`, e per la stessa ragione: la tappa E, la F e la G aggiungono
sedici chiamate e non devono toccare il motore.

Una riga è `{ id, when(game, k), lines }`. I predicati si guardano **due volte al secondo, e
solo mentre Kkachi può parlare**: fuori dall'auto non si valuta niente. Quello che un predicato
non può leggere dallo stato del gioco — «primo furto d'auto **con testimoni**», «terza morte,
*uscendo* dal 병원» — lo legge dai **fatti recenti**: `story/kkachi.js` si iscrive al bus e
scrive `k.mark('furtoVisto')`, il predicato chiede `k.since('furtoVisto') < 45`. Nessun sistema
del gioco sa che esiste una radio che lo guarda, ed è il bus del §5.27 che finalmente serve alle
due cose per cui era stato scritto.

Tre eventi hanno guadagnato un argomento, perché **il fatto si sa solo lì**:

| Evento | Argomento nuovo | Perché non si può ricavare dopo |
| --- | --- | --- |
| `enterVehicle` | `witness` | un istante dopo la griglia dei pedoni è già un'altra |
| `districtChange` | `first` | quando l'evento parte, il distretto è **già** in `stats.districts` |
| `turfClaimed` | `wasMine` | dopo quella riga il cortile è già del padrone nuovo |

E ne è nato uno: `shopBuy(item, floor)`, che mancava e che serviva anche senza Kkachi.

#### Le sei regole del copione, e dove stanno scritte

Sono cablate nel motore, non nelle righe, perché valgono per tutte e ventiquattro:

1. **solo in macchina, sulla `91.45`** → `canSpeak`. A piedi, in un negozio, in metro o in cella
   la tabella non si guarda nemmeno;
2. **chi non accende la radio non sente mai una parola** → non c'è nessun avviso, da nessuna
   parte, e **vale anche per la trama**: le tre battute di M1, M2 e dell'apertura passano di qui
   e scadono dopo quattro minuti se la radio resta spenta. Il prezzo di non cercare quella voce
   doveva essere reale o la regola era un ornamento;
5. **chiamata interrotta = chiamata persa** → `done` si scrive **all'inizio**, non alla fine.
   Scritto alla fine, scendere dall'auto avrebbe rimesso la chiamata in fila al semaforo dopo;
6. **la radio vera vince sempre** → Kkachi non abbassa e non si sovrappone: se la manopola è su
   un'altra stazione, `canSpeak` è falso e basta.

Restano fuori dal motore le regole 3 (ogni battuta è copiata da qualcun altro) e 4 (non dice mai
«non lo so»), che sono regole di **scrittura**: la prima è tenuta onesta dai commenti
`// origine:` in testa a ogni chiamata di `story/kkachi.js`, e vanno mantenuti — sono la prova
del settimo colpo di scena, non una nota.

**E una regola in più, che il copione dà per scontata:** con le stelle addosso Kkachi tace. Non
comincia niente finché il ricercato è sopra zero; una conversazione già in corso invece va
avanti, perché non stava commentando nessun inseguimento.

#### Il riquadro non è un dialogo

`ui/dialogue.js` ferma il mondo e aspetta lo Spazio. Qui il giocatore **sta guidando**: niente
modalità in `core/modes.js`, niente tasto, le battute scorrono da sole a velocità di lettura
(1,9 s più 42 ms per carattere). Un menu aperto la mette in pausa; scendere dall'auto la perde.
Il riquadro sta in alto al centro, dove la fascia è libera fra i vitali e l'orologio — su schermo
stretto scende sotto le due colonne, che lì si toccano.

Dentro c'è il **quadrante**, con l'indice fermo su `91.45`, ed è lo stesso oggetto del pannello
26 dell'apertura e del secondo pannello di M1: chi lo vede in strada lo riconosce. La frequenza
sta dove gli altri hanno un nome — è la regola 5, ed è l'indizio principale del settimo colpo di
scena reso fatto tipografico. Quando risponde Jae-min il nome compare a destra, in ambra, e la
riga di Kkachi resta senza.

#### Le dodici righe di salita, e perché non nell'ordine del copione

Sono quelle che il giocatore sente cento volte, quindi ognuna dice **un fatto** e nessuna
commenta lui. La tabella del copione le elenca `S1…S12`; qui l'ordine è un altro, e la ragione è
aritmetica: la scelta è «la prima condizione vera», e le condizioni d'orologio sono vere quasi
sempre. Messe in cima, le cinque situazionali (l'auto appena rubata, la carrozzeria malandata,
la volante ferma, il distretto mai visto, le tasche vuote) non sarebbero uscite mai. L'ordine è
**situazione → meteo → orologio**, e la stessa riga non si dice mai due volte di fila.

Una riga sola è stata cambiata rispetto al copione: `S1` dice «Le sei e dieci», che alle 07:40 è
falso. Dice l'ora vera.

#### Il conto che serve al finale C

Venti chiamate su ventiquattro sono una delle tre condizioni del finale nascosto
(`06-finali-ed-epilogo.md`), quindi il conto è **stato di partita**: nel salvataggio vanno le
chiamate andate, quante ne ha ascoltate per intero e quante ne ha perse a metà — quest'ultimo
numero comparirà solo nei titoli di coda. Formato `v5`, e lo scalino `4 → 5` mette tre campi
vuoti: uno slot della tappa C è una partita in cui quella stazione non esisteva, quindi chi lo
ricarica ha le ventiquattro ancora tutte davanti.

I **fatti recenti** (`marks`) invece non si salvano apposta: riprendere una partita non deve far
partire la battuta del furto d'auto di tre giorni fa.

#### Cosa si è pagato di quello che era in elenco

- le **tre righe di Kkachi appese a un `hud.toast`** (§5.29) adesso passano dalla stazione. Sono
  tre e non quattro come diceva il §6.0: la quarta era il pannello del quadrante in apertura di
  M1, che era già un pannello vero;
- **«nessuno ti avvisa se ti portano via un cortile»** (§5.31): adesso te lo dice lui, e **solo
  se non c'eri** — sotto i 1200 px l'hai già visto succedere, e il cartello a terra lo dice.

#### Quello che non è stato fatto, e si sa

- **la regia sonora dell'apertura** (fruscio di banda sotto la voce che conta, il cane, la
  sirena lontana) resta da fare. Il timbro del fruscio adesso c'è ed è quello giusto, quindi il
  lavoro è più corto di prima; quello che manca è un **aggancio dei suoni ai pannelli**
  (`ui/cutscene.js` non ne ha uno) e tre suoni nuovi;
- **l'ottava chiamata dell'Atto I aspetta M3**: il predicato è già quello definitivo
  (`missions.isDone('m3')`) e resta falso finché la tappa E non esiste. Non è un pezzo mancante,
  è una riga che non si è ancora avverata;
- **le sedici chiamate degli Atti II e III non ci sono**, come da §6.0: vanno con le tappe F e G,
  e sono righe in `story/kkachi.js` e nient'altro;
- **le «visite che cambiano»** (Jo dopo M6, Chun-sik dopo M9, il commesso dopo M8) stanno nello
  stesso capitolo del copione ma non sono chiamate radio: restano alle tappe delle loro missioni.

#### Come si prova

```bash
node .claude/tools/probe.mjs --seconds 1 --quiet \
  --script .claude/tools/scenes/kkachi.scene \
  --eval "Object.entries(window.__OUT).filter(([k,v]) => v===false).map(([k])=>k)"
```

`[]` vuol dire tutto a posto. Ventinove asserzioni, e quattro sono invarianti:
`nienteReteSuNoveUnoQuattroCinque`, `zittoAPiedi`, `persaNonTornaMai`, `zittoSottoLeStelle`.
A mano: si sale in macchina, `R`, e si gira per Seoul.
