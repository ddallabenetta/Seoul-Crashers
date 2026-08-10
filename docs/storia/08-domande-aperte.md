# Decisioni prese — e la sola che resta aperta

> Indice: [`README.md`](README.md). Questo documento era la lista delle domande da fare
> all'utente prima di toccare il codice. **Nove su dieci hanno una risposta**, data
> esplicitamente: qui restano scritte come decisioni, con la conseguenza che portano.
> Chi implementa parte da qui, non dalle sue preferenze.

---

## 1. I pannelli parlano o no? → **Solo testo. Deciso.**

Nessuna voce, nessun verso, nessun parlato. I pannelli si leggono.

**Conseguenze da tenere presenti mentre si scrive:**

- **Le battute vanno accorciate.** Un dialogo che funziona recitato è troppo lungo letto. I
  botta e risposta dei tre atti sono già scritti corti apposta; se in fase di disegno un
  pannello risulta pieno di testo, si taglia la battuta, **non si rimpicciolisce il corpo**.
- **Kkachi non si distingue più per timbro**, e distinguerlo serve: è l'indizio principale
  del settimo colpo di scena. Va fatto per iscritto — le sue righe non hanno un nome davanti
  come le altre, ma il quadrante della frequenza, e stanno sempre da sole nel pannello. La
  radio ha già il suo fruscio (§5.13): quello resta e fa da voce.
- **Il silenzio va scritto**, perché non si sente più. Dove il copione dice «sette secondi di
  fruscio» (R4, M10) serve un pannello fermo con niente dentro, e va tenuto: è metà del
  personaggio.

## 2. La cutscene iniziale si può saltare? → **Sì. Deciso.**

Sempre saltabile, dal primo avvio.

**Conseguenza, che è già coperta:** i tre pannelli-indizio non vanno persi, e non si perdono
da soli. Il pannello 11 (la fotografia specchiata) **torna in M4**, accanto alla foto vera; il
19 (la mano destra in tasca) torna in M7 e in M8; il 26 (la prima frase di Kkachi) è ripetuto
da Kkachi stesso in M4 e in R4. Chi salta l'apertura arriva agli stessi ribaltamenti da un'altra
porta. **Nessun album da costruire nel menu.**

## 3. Come si attiva una missione? → **Un blip per la missione attiva. Deciso.**

Uno solo, sulla missione in corso. Niente elenco di commissioni sulla mappa.

**Conseguenza:** le missioni che il copione fa innescare da un luogo o da un'ora (M3 alle
`03:20`, M6 alle `14:00`) portano il blip **dove si aspetta**, non dove si comincia — il blip
è la destinazione, l'ora la dice il pannello d'apertura o Kkachi.

## 4. Cosa succede quando una missione fallisce? → **Riparte dall'ultima fase. Deciso.**

Le fasi sono già scritte, numerate, nella voce «Svolgimento» di ogni missione.

**Conseguenze:**
- **Le cutscene non si rivedono mai due volte.** Riprendere da una fase non rimette i pannelli.
- **Restano le due eccezioni già nel copione**, ed erano scritte prima della decisione, quindi
  reggono: **M9** ripete il dialogo del tratto (è l'unica punizione possibile in una missione
  fatta di conversazione) e **M12** riparte con meno gente viva accanto, perché il finale conta
  i vivi.

## 5. Le missioni si possono rigiocare? → **ancora da decidere**

È la sola rimasta, e non blocca niente: si può implementare tutto l'impianto senza rispondere,
e rispondere alla fine.

La proposta resta quella di prima: **no** dentro la partita in corso (rovinerebbe la storia, e
il salvataggio è piccolo apposta — §5.15), **sì** da una voce «Rivedi» nel menu che rimette
solo i pannelli, senza rigiocare niente. Costa un elenco di pannelli visti nel salvataggio.

## 6. Quanto pesa un pannello? → **Un pannello = una funzione. Deciso.**

Come uno sprite (§5.4): una funzione che disegna su un canvas offscreen, con primitive
condivise (silhouette, insegna, pioggia, neon, vetro, interni). Il costo è sorgente, non
memoria: si disegna al momento e si butta.

**Conseguenza:** ~110 pannelli in tutto il copione, e vanno divisi — **un file per atto**, più
uno per la cutscene iniziale, più uno per finali ed epilogo. Un `panels.js` unico da tremila
righe è esattamente il file che questo progetto non ha mai avuto.

## 7. La proprietà dei cortili diventa persistente? → **Sì. Deciso.**

Stato sul turf, dentro il salvataggio, con effetto sul commercio.

**Conseguenza, ed è la più importante di tutte:** **va fatta prima delle missioni, non dentro
M5.** È l'unica cosa della campagna che cambia il mondo in modo permanente, tocca il
salvataggio (§5.15) e i prezzi (§5.8), e M5 la usa e basta. Nel §6 era già in elenco come
debito aperto: adesso ha un motivo e una data.

## 8. Tre finali o uno? → **Tre. Deciso.**

A (태워), B (틀어) e il nascosto C (지워).

**Conseguenza:** **le ventiquattro chiamate radio diventano contenuto obbligatorio**, non
facoltativo per chi sviluppa. Una delle tre condizioni del finale C è averne ascoltate venti;
senza le chiamate, C sarebbe un premio per niente. Servono anche un flag di finale nel
salvataggio (per la scena dopo i titoli) e le tre condizioni nascoste da tracciare.

## 9. Kkachi è un sistema o è scritto a mano? → **Una tabella di righe con predicato. Deciso.**

Come `WEAPONS` o `BUSINESSES`: ogni riga è una chiamata con la sua condizione (luogo, ora,
meteo, prima volta di un evento, avanzamento della storia) e il suo testo.

**Conseguenza:** il sistema serve **anche alle righe di servizio** (le dodici battute di
salita in auto, l'uscita di prigione, le cinque stelle in cui Kkachi tace) e resterà buono per
le attività secondarie. Si tara come tutto il resto, e va in `docs/parametri.md` quando esiste.

## 10. Le missioni prima o le attività secondarie prima? → **La storia prima. Deciso.**

Consegne, taxi e corse dopo. Il corridoio Seoul-Busan riceve un senso da M9 e lo tiene.

---

## Le tappe, adesso che le risposte ci sono

Confermate come piano di lavoro. Ogni tappa è provabile da sola, che è come lavora questo
progetto (§7), e **si consegna una per volta**.

| Tappa | Cosa contiene | Si prova così |
| --- | --- | --- |
| ~~**A**~~ | ~~primitive dei pannelli + cutscene iniziale~~ — fatta | avvio e cutscene |
| ~~**B**~~ | ~~impianto missioni + M1 e M2~~ — fatta | scena `missioni-run` |
| ~~**C**~~ | ~~cortili persistenti~~ — fatta | snapshot/restore e commercio |
| ~~**D**~~ | ~~Kkachi 91.45, 24 chiamate e servizio~~ — fatta | radio in auto |
| ~~**E**~~ | ~~Atto I (M3, M4) + R1~~ — fatta | catena missioni |
| ~~**F**~~ | ~~Atto II (M5-M8) + R2 e R3~~ — fatta | catena missioni |
| ~~**G**~~ | ~~Atto III (M9-M12), R4 e Busan~~ — fatta | viaggio e terminal |
| ~~**H**~~ | ~~finali, titoli e scena dopo~~ — fatta | tre rami finali |

**Cambia una cosa rispetto alla prima stesura:** i cortili persistenti salgono in tappa C,
prima delle missioni che li usano, per la ragione scritta al punto 7.

**E una cosa non sta nella fila:** il filo del 병원 ([`09-ospedale.md`](09-ospedale.md)) va
agganciato alla **B**, perché si accumula per tutta la partita e alla H sarebbe tardi. Costa un
intero nel salvataggio e nient'altro.

**Le otto tappe sono concluse (§5.30).**
