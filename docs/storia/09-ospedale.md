# Il 병원 «성심» — quello che succede ogni volta che muori

> Indice: [`README.md`](README.md). Chi è Jeong Han-su: [`01-personaggi.md`](01-personaggi.md).
> **Contiene lo spoiler di M12**, ed è l'unico documento del copione che lo contiene per
> intero: la scena di M12 è il punto in cui questo filo si scioglie.

Il soggetto promette che **l'ospedale conta** ([`00-soggetto.md`](00-soggetto.md), §6) e
[`01-personaggi.md`](01-personaggi.md) promette un direttore con una battuta diversa a ogni
risveglio. Nessuno dei due dice quali. Questo documento le scrive.

È il pezzo di copione più economico del gioco: **non chiede niente al motore**. Il risveglio
al 병원 esiste dal §5.16, costa già un quarto dei contanti e l'arsenale, e dal §5.27 emette
già un evento (`respawn`) con dentro quale ospedale. Il filo qui sotto è tutto testo appeso a
quell'evento.

---

## La regola, prima delle battute

**Non è una cutscene.** Un pannello a ogni morte, in un gioco in cui si muore, è una
punizione — e la punizione ce l'ha già data il gioco (un quarto dei contanti, l'arsenale, e la
strada da rifare). Quindi:

- **Quasi tutti i risvegli sono una riga sola**, dove il gioco già ne mette due: il messaggio
  dell'ospedale c'è dal §5.16, e qui gli si aggiunge in coda la battuta del direttore. Costa
  zero secondi al giocatore.
- **Quattro risvegli sono un pannello**, corto e saltabile con qualunque tasto: il **primo**,
  il **terzo**, il **decimo** e il **primo dopo M12**. Sono i quattro punti in cui il
  personaggio cambia registro, e sono abbastanza rari da non pesare.
- **Le battute non si ripetono mai**, e quando finiscono si passa alla forma con il numero
  (sotto). Chi muore trenta volte non deve sentire due volte la stessa cosa: è l'unico modo in
  cui una gag può reggere trenta ripetizioni.
- **Jeong Han-su non commenta mai come sei morto.** Non lo sa, non lo chiede, e questo è il
  personaggio: per lui non è una storia, è un turno.

---

## Le battute, in ordine di risveglio

Il numero a sinistra è il conto delle morti in partita. Dove non c'è pannello, la riga esce nel
messaggio dell'ospedale.

| # | | Battuta |
| --- | --- | --- |
| 1 | **pannello** | «Signor Seo. Le spiego come funziona qui: lei arriva, noi la rimettiamo insieme, lei paga, e poi ci ripensiamo tutti e due.» |
| 2 | | «Bentornato. Non è un modo di dire.» |
| 3 | **pannello** | «Tre. Da medico le dico una cosa sola, poi non gliela ripeto: il corpo tiene il conto anche quando lo dimentica lei.» |
| 4 | | «Ha una milza sola. Glielo dico perché la tratta come se ne avesse due.» |
| 5 | | «Il caffè della macchina al secondo piano è pessimo. Glielo dico perché ormai lo conosce.» |
| 6 | | «Di lato è meglio che davanti. Non è una consolazione, è una statistica.» |
| 7 | | «La signora del letto accanto ha chiesto se lei è un poliziotto. Le ho detto di no e mi ha risposto: peccato.» |
| 8 | | «I suoi vestiti li buttiamo ogni volta. Quello nero con la tigre no: quello me lo fanno rimettere a posto. Non ho chiesto da chi.» |
| 9 | | «Ho smesso di scrivere la causa per esteso. Adesso scrivo *come sopra*.» |

**Dal decimo in poi**, e per tutto il resto della partita, dice il numero. È il momento in cui
smette di far finta, ed è **un pannello**:

> Jeong: «Signor Seo. Dieci.»
> Jae-min: «Lo sta contando?»
> Jeong: «Lo conta qualcun altro. Io lo leggo.» *(guarda la cartellina, poi lui)* «Non glielo
> dico per rimproverarla. Glielo dico perché io le voglio bene, e qualcuno le vuole bene meno
> di me e paga lo stesso.»

Da lì in avanti la riga è sempre la stessa forma, con il numero vero:

> Jeong: «Signor Seo. **[N]**.»

*(Il numero è quello della partita in corso: è lo stesso che M12 stampa sulle fatture, e i due
devono coincidere o il colpo di scena non colpisce. È l'unica riga di dialogo di tutto il
copione con dentro una variabile.)*

**«Lo conta qualcun altro. Io lo leggo.»** è la frase che regge tutto il filo, e va detta al
decimo risveglio e mai più. Chi muore dieci volte l'ha già sentita quando arriva a M12; chi non
ci arriva scopre la stessa cosa dalle fatture, che sono lì apposta.

---

## Cosa cambia dopo M12

Sulla scrivania di Ryu ci sono dodici anni di fatture del 병원 «성심» intestate a 한성개발
([`05-atto-3.md`](05-atto-3.md), M12 punto 5). Da quel momento il giocatore sa chi paga, e il
**primo risveglio dopo M12 è un pannello**:

**1 ·** La solita corsia. Jeong Han-su in piedi con la cartellina, che stavolta non la guarda.

> Jeong: «Lo ha scoperto.»
> Jae-min: «Da quanto lo sa lei?»
> Jeong: «Da sempre. Sono le fatture: non è che uno le nasconda, uno le manda.»
> Jae-min: «E ha continuato.»
> Jeong: «Ho continuato a rimetterla in piedi, sì. Non mi hanno mai chiesto di fare altro, e
> se me lo avessero chiesto avrei detto di no.» *(pausa)* «Credo.»

**2 ·** La cartellina appoggiata sul letto, girata verso lo schermo: in alto, l'intestazione
della fattura.

> Jae-min: «Può smettere di mandarle?»
> Jeong: «No.» *(la riprende)* «Posso sbagliare l'indirizzo.»

Dopo questa scena le battute dei risvegli seguenti **non tornano quelle di prima**: restano tre
righe sole, in rotazione, e sono tutte e tre la stessa cosa detta in tre modi.

> «**[N]**. L'indirizzo l'ho sbagliato di nuovo.»
> «Le hanno telefonato per chiedere se lei era passato. Ho detto che non mi risulta.»
> «Vada. Qui dentro lei non risulta più, e le assicuro che è la cosa più cara che le ho dato.»

---

## Il caso di chi non muore mai

Va previsto, perché è possibile e perché è il caso in cui la scena di M12 crollerebbe: se il
contatore è a zero, la cartellina delle fatture è vuota e il colpo di scena non ha niente da
mostrare. **Non si rattoppa con una fattura finta.** M12 cambia riga, e diventa più cattivo:

> Ryu: «Lei non ci è mai costato niente, lo sa? Dodici anni di copertura e mai una fattura. Io
> ho seicento dipendenti e nessuno mi ha reso così.» *(si toglie gli occhiali)* «È il nostro
> miglior investimento, signor Seo, e non se n'è nemmeno accorto.»

*(È l'unico ramo condizionale della sceneggiatura, e vale la spesa: la versione a zero morti è
la versione che il giocatore bravo si è guadagnato, e fa più male di quella normale.)*

---

## Le due cose che questo filo non è

- **Non è un contatore di colpe.** Jeong Han-su non giudica, non insiste, non si commuove.
  Il giorno in cui il gioco fa capire che l'ospedale è dalla parte del giocatore, l'ospedale
  smette di funzionare.
- **Non è il posto dove si spiega M12.** Le fatture si vedono lì, non qui. Fino a M12 nessuna
  battuta di questo documento dice **chi** paga: la più esposta arriva a «qualcun altro», e si
  ferma. Regola 6 ([`README.md`](README.md)).

---

## Poggia su

Risveglio al 병원 dopo la morte, un quarto dei contanti, arsenale confiscato, ricercato
azzerato (§5.16) · l'evento `respawn` e l'autosave `ospedale` (§5.20, §5.27) · i messaggi
dell'HUD che il risveglio già stampa (§5.16) · pannelli e lettore (§5.28) · un ospedale per
distretto, generato (§5.9).

## Chiederebbe

- **Un conto delle morti nel salvataggio.** Oggi il gioco muore e dimentica: il numero serve
  qui e serve a M12, ed è un intero.
- **Un pannello che si chiude da solo** dopo pochi secondi, o al primo tasto: questi quattro
  non devono mai diventare qualcosa da saltare a memoria.
- **Un ramo condizionale in M12** sul contatore a zero.
