# Domande aperte — cosa decidere prima di scrivere una riga di codice

> Indice: [`README.md`](README.md). Questo documento **non propone un'implementazione**: elenca
> le scelte che il copione lascia in sospeso, con una raccomandazione per ciascuna. Il §7 dice
> che l'utente vuole essere consultato invece di trovarsele fatte: questa è la lista.

---

## 1. I pannelli parlano o no?

Il gioco non ha mai fatto parlare nessuno: `VOICES` serve solo a urlare e a lamentarsi (§6).
Tre strade:

| | Costo | Effetto |
| --- | --- | --- |
| **Solo testo** | niente di nuovo | il gioco resta muto e si legge. Coerente con i fumetti, e con un gioco senza asset |
| **Versi sintetizzati** (una vocale modulata per battuta, stile *Banjo-Kazooie*) | basso: `VOICES` esiste già | dà il ritmo, caratterizza i personaggi, non impegna a una lingua |
| **Parlato vero** | impossibile senza asset esterni | fuori dai vincoli del progetto |

**Raccomandazione: versi sintetizzati per i personaggi in scena, e per Kkachi qualcosa di
diverso** — una voce filtrata a banda stretta, che è la cosa che un sintetizzatore sa fare
bene e che dice al giocatore «questa non è una persona» senza spiegarglielo.

## 2. La cutscene iniziale si può saltare?

Ventotto pannelli sono lunghi. Ma il pannello 11 (la fotografia specchiata), il 19 (la mano in
tasca) e il 26 (la prima frase di Kkachi) sono **tre delle sette semine** della storia.

**Raccomandazione:** saltabile dal secondo avvio in poi, mai al primo. In alternativa: sempre
saltabile, ma i tre pannelli-indizio restano consultabili da un «album» nel menu di pausa.

## 3. Come si attiva una missione?

Il copione dice sempre *chi* la innesca, mai *come*. Le possibilità che il gioco già
sosterrebbe: un blip sulla mappa (§5.9), una porta di un interno (§5.8), una telefonata via
radio (§5.14), un'ora del giorno (§5.11), un luogo in cui passare.

**Raccomandazione:** un blip per la missione attiva e **basta uno**. Questo gioco ha una mappa
grande e una storia lineare: due marcatori insieme la rendono una lista di commissioni.

## 4. Cosa succede quando una missione fallisce?

Il copione elenca i fallimenti caso per caso ma non decide la regola. Le tre scuole:
ricomincia da capo (Chinatown Wars), riparte da fase (GTA IV in poi), non fallisce mai e si
adatta.

**Raccomandazione:** riparte dall'ultima fase, e **le cutscene non si rivedono mai due volte**.
Con l'eccezione dichiarata di M9, dove il copione *vuole* che si riascolti il dialogo perso.

## 5. Le missioni si possono rigiocare?

**Raccomandazione: no, e sì.** No nella partita in corso (rovina la storia e il salvataggio è
piccolo apposta, §5.15). Sì da una voce «Rivedi» nel menu, che rimette solo i pannelli.

## 6. Quanto pesa un pannello?

Sono ~110 pannelli in tutto il copione. Se ognuno è una funzione di disegno come uno sprite
(§5.4) sono tanti, ma il costo è **codice sorgente**, non memoria: si disegnano al momento e
si buttano. Va deciso presto perché cambia come si scrivono.

**Raccomandazione:** un pannello = una funzione che disegna su un canvas offscreen, con una
manciata di primitive condivise (silhouette, insegna, pioggia, neon, interni). E **un file per
atto**, per non fare un `panels.js` da tremila righe.

## 7. La proprietà dei cortili diventa persistente?

M5 la chiede esplicitamente, e il §6 la elencava già come «materia della storia». Vuol dire
uno stato sul turf, dentro il salvataggio, con un effetto sul commercio.

**Raccomandazione: sì, e va fatta prima delle missioni**, perché è l'unica cosa della storia
che cambia il mondo in modo permanente. È anche l'unica voce del §6 che questa storia paga
per intero.

## 8. Tre finali o uno?

Il costo vero non sono i finali: è il **flag nel salvataggio** e le tre condizioni nascoste
del finale C.

**Raccomandazione:** A e B da subito (sono sei pannelli l'uno), C solo se le chiamate radio
vengono fatte davvero. **Un finale nascosto senza le ventiquattro chiamate non ha senso**:
sarebbe un premio per niente.

## 9. Kkachi è un sistema o è scritto a mano?

Ventiquattro chiamate con condizioni d'innesco eterogenee (luogo, ora, meteo, prima volta,
avanzamento) sono un sistemino. Farlo bene costa poco e serve anche alle attività secondarie.

**Raccomandazione:** una tabella di righe con predicato, esattamente come `WEAPONS` o
`BUSINESSES`. È lo stile del progetto e si tara come tutto il resto (§8).

## 10. Le missioni prima o le attività secondarie prima?

Il §6 dice che il corridoio Seoul-Busan è «geografia, non ancora contenuto» e che le attività
secondarie sono la sua superficie naturale. La storia invece **attraversa** quel corridoio in
M9 e gli dà un senso.

**Raccomandazione: la storia prima.** Le consegne e le corse hanno più senso in un mondo che
ha già un motivo per essere percorso.

---

## Una proposta di tappe

Se e quando si passa al codice, il copione si lascia tagliare così — ogni tappa è provabile
da sola, che è come lavora questo progetto (§7):

| Tappa | Cosa contiene | Perché si può provare da sola |
| --- | --- | --- |
| **A** | il sistema di pannelli + **la cutscene iniziale** | si avvia il gioco e si guarda: o funziona o no |
| **B** | l'impianto delle missioni (attivazione, fasi, fallimento) + **M1 e M2** | due missioni intere, una in strada e una in un interno |
| **C** | Kkachi: stazione `91.45`, tabella delle chiamate, le otto dell'Atto I | si gira per Seoul e la radio parla |
| **D** | Atto I completo (M3, M4) + R1 | il primo ribaltamento in mano al giocatore |
| **E** | cortili persistenti + Atto II (M5-M8) + R2, R3 | l'atto che chiede più cose nuove al motore |
| **F** | Atto III (M9-M12) + R4 | il viaggio: ha bisogno di tutto quello di prima |
| **G** | finali, titoli di coda, scena dopo | e a quel punto la Fase 3 è chiusa |

**La tappa A è quella da concordare per prima**, perché tutto il resto ci si appoggia sopra —
e perché è anche l'unica che si può guardare senza aver giocato niente.
