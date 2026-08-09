# Cutscene iniziale — «12년» (Dodici anni)

> Indice: [`README.md`](README.md) · Personaggi: [`01-personaggi.md`](01-personaggi.md) ·
> Prima missione giocata: [`03-atto-1.md`](03-atto-1.md) ·
> Com'è fatta dentro: [`../storico/17-pannelli-e-cutscene.md`](../storico/17-pannelli-e-cutscene.md).

Quello che il giocatore vede dopo aver scelto **Nuova partita** dal menu (§5.18), prima di
avere il controllo. Ventotto pannelli, tre stacchi neri, un titolo. **È implementata**
(`src/story/intro.js`): questo documento e il codice si tengono allineati, e quando divergono
comanda questo.

## Regole di questa scena

- **Ogni pannello è una figura ferma**, disegnata con le primitive che il gioco ha già:
  campiture piatte, due o tre colori del distretto, insegne in hangul, righe di pioggia.
- **I personaggi sono pixel art e si vedono in faccia.** *Deciso con l'utente, e sostituisce
  la regola precedente («le facce non hanno tratti, si leggono dalla posa»), che a schermo
  produceva cinque sagome identiche.* Ogni personaggio ha una testa disegnata a mano — occhi,
  sopracciglia, bocca, capelli — più un dettaglio che lo rende riconoscibile a colpo d'occhio:
  la stempiatura grigia di Chun-sik, il berretto e gli occhiali del tassista, la frangia del
  commesso, la cicatrice del ritratto. **La folla no**: resta sagoma, ed è quello che fa
  leggere Jae-min come l'unico fermo.
- **Due eccezioni al «si vede in faccia», e sono di trama:** il riflesso nell'oblò (pannello 3)
  è mezzo spento apposta, e **Dulchae non si vede mai** (pannello 19) — di lui c'è una mano.
- **Il narratore dice solo cose vere e verificabili** — ore, altezze, targhe, date, prezzi — e
  non entra mai nella testa di Jae-min. **Traduce l'hangul che porta trama** (il manifesto
  della demolizione, il minimarket, il nome sulla bara); quello decorativo no.
- **Il gioco spiega una volta.** Chi è Jae-min, chi è il morto, cos'è 한성개발 e cosa c'è
  scritto sul manifesto si dicono **in chiaro, una volta sola**, nel pannello in cui compaiono.
  Non si ripetono nei dialoghi.
- **Gli indizi si rendono visibili, mai spiegati.** La cicatrice specchiata, la mano in tasca,
  il «di nuovo?» del commesso e il presente di Chun-sik si devono *notare* e non si devono
  capire. Dove servivano occhi troppo buoni — la lancetta che scorre mezza tacca, lo spessore
  di una busta — è il narratore a dire dove guardare, senza dire cosa significa.
- **Si può saltare**, sempre, dal primo avvio, con `ESC`
  ([`08-domande-aperte.md`](08-domande-aperte.md)). I pannelli 11, 19 e 26 sono i tre indizi
  seminati qui, e **tornano tutti e tre più avanti** (11 in M4, 19 in M7 e M8, 26 in M4 e R4):
  chi salta arriva agli stessi ribaltamenti da un'altra porta.
- **Nessuno parla: si legge.** Se una battuta non ci sta in un pannello si taglia la battuta,
  **non si rimpicciolisce il corpo**.
- **Sotto la scena suona il tema dell'apertura** (§5.19). Basso, lento, senza batteria: sopra
  c'è da leggere. Sale solo sull'ultima tavola, che è il titolo.
- Il pannello 1 e l'ultimo pannello del gioco sono **la stessa immagine con un dettaglio
  cambiato**. Vedi [`06-finali-ed-epilogo.md`](06-finali-ed-epilogo.md).

---

## Parte prima — la frequenza (pannelli 1-4)

**1 · Nero.** Nessuna immagine. Solo audio: fruscio di banda, e una voce di donna che conta in
coreano, lenta, come una stazione di numeri. `공. 하나. 하나. 넷. 아홉.` La conta si ripete tre
volte. Alla terza, sotto la voce, si sente per un istante **un cane che abbaia lontano** — lo
stesso cane tornerà nel pannello 27.

> Narratore: `Nessuna immagine. Una radio accesa, e una voce che conta in coreano:`
> `zero, uno, uno, quattro, nove.`
>
> Voce alla radio: «…quattro. Nove. Non toccare la manopola.»

*(La voce non ha ancora un nome e non deve averlo: ce l'avrà al pannello 26.)*

**2 · Nero, testo bianco.** Tre righe, allineate a sinistra:

> Dodici anni fa un uomo ha venduto un quartiere che non era suo.
> Gli hanno dato dodici anni di tempo.
> Martedì il tempo è finito.

**3 · L'oblò.** Interno d'aereo, notte, dal posto finestrino. Fuori: il **서해**, nero, e
un'unica riga arancione all'orizzonte. Sul vetro, il riflesso della faccia di Jae-min: mezzo
spento, gli occhi bassi. È la prima volta che si vede, ed è giusto che si veda così.

> Narratore: `06:41 · 12.000 metri sopra il Mar Giallo.`
> `Volo da Los Angeles. Atterra fra un'ora.`

**4 · La stessa inquadratura, sotto.** L'ala, e sotto l'ala Seoul che comincia: la griglia
delle luci, il taglio nero del **한강** in mezzo. Sul fiume, tre ponti accesi.

> Narratore: `Seoul. Ventitré milioni di persone, tre ponti.`
> `Seo Jae-min ci è nato. Manca da dodici anni.`

*(Qui il gioco dice per la prima volta **chi si sta guardando**. Il pannello 4 è anche la mappa
del gioco vista da 12.000 metri: chi ci tornerà alla fine riconoscerà il taglio del fiume.)*

---

## Parte seconda — l'arrivo (pannelli 5-10)

**5 · 김포공항, arrivi.** Sagome in fila davanti a un nastro bagagli. Insegna: `김포국제공항`.
Jae-min è davanti, grande, e **l'unico fermo** mentre tutti si muovono: da qui alla fine della
scena è sempre l'unico fermo, ed è il modo in cui si riconosce.

> Narratore: `Aeroporto di Gimpo, 08:10. Nessuno è venuto a prenderlo.`

**6 · Il telefono.** Primo piano di una mano e di uno schermo. Un solo messaggio, in coreano,
di tre giorni prima: `삼촌 — 장례식장. 홍대. 오면 알아본다.`

> Zio: «La camera ardente è a Hongdae. Se vieni, sanno chi sei.»
> *(nota)* Tre giorni fa, e non c'è altro: niente sopra, niente sotto. In rubrica ha quattro nomi.

**7 · Taxi, pioggia.** Il finestrino in alto, con fuori l'autostrada, i capannoni di 김포 e le
risaie. Sotto, i due che parlano a mezzo busto: il tassista a sinistra, Jae-min a destra. Sul
cruscotto, il quadrante della radio.

> Tassista: «Da quanto tempo è via?»
> Jae-min: «Dodici anni.»
> Tassista: «Allora non riconosce più niente.»
> Jae-min: «Riconosco l'odore.»

**8 · Il quadrante.** Primo piano della radio del taxi. La lancetta scorre e si ferma **fra le
due tacche**. Fruscio. Una sillaba, mangiata.

> Narratore: `La lancetta scorre e si ferma fra 91.4 e 91.5. Fra due tacche.`
>
> Tassista: «Fa così da anni. È rotta.»
> *(nota)* Non si volta a guardare.

*(Prima apparizione della frequenza. Nessuno la nomina — ma il narratore dice dove guardare,
perché mezza tacca su un quadrante largo un terzo di pannello non la vede nessuno.)*

**9 · L'ingresso di Hongdae.** Il taxi che si infila fra le insegne. Neon rosa, muri con i
murales, cavi in cielo. Piove forte. Sul muro a destra, un manifesto grande, nuovo, incollato
male.

> Narratore: `홍대, Hongdae. Piove da tre giorni.`
> `Sul muro un manifesto nuovo: 철거예정 — demolizione prevista.`

**10 · Il manifesto, più vicino.** Sotto le due parole, una data.

> Narratore: `한성개발 · Hanseong Development.`
> `Demolizione prevista: 21 settembre. Fra sei settimane.`

*(È il nome del nemico, ed è l'unica volta in tutta l'apertura in cui viene scritto in latino.)*

---

## Parte terza — il funerale (pannelli 11-19)

**11 · 장례식장.** Sala della camera ardente. Crisantemi bianchi in due file, il ritratto
**grande** in mezzo con la fascia nera, buste bianche sul tavolino. Una decina di sagome
inginocchiate davanti, in ombra.

**Il ritratto:** un uomo sui cinquanta, giacca scura, e **una cicatrice sulla guancia che chi
guarda vede a destra**.

> Narratore: `서동혁 · Seo Dong-hyeok. 1968-2026.`
> `Suo padre. Incidente sul lavoro, molo 7, porto di Incheon.`

*(È il primo indizio del gioco, e il ritratto è largo un quarto di pannello apposta. Nella foto
la cicatrice sta a destra di chi guarda: **la stampa è specchiata**. In tutti e sette i pannelli
di ricordo, per tutti e tre gli atti, sta dall'altra parte. Nessun personaggio lo nota prima di
M4. Che il morto sia **suo padre** si dice qui, in chiaro: nella prima stesura la parola non
compariva in tutta la scena.)*

**12 · Le buste.** Primo piano del tavolino delle offerte. Tre buste. Su una c'è scritto
`한성개발`. È **la più spessa**, e si vede dallo spessore del fianco.

> Narratore: `Buste di condoglianze. Sono tre.`
> `La più spessa è di 한성개발.`

**13 · Chun-sik.** Uno grosso in giacca nera che si alza da terra con fatica e apre le braccia,
**ridendo**. È l'unica faccia che sorride in tutta la scena. Dietro di lui, sei uomini del
백호파 che non si alzano.

> Chun-sik, lo zio: «Ragazzo. Ragazzo. Guardati. Mangi?»
> Jae-min: «Zio.»
> Chun-sik: «Tuo padre dice sempre che in America si mangia male.»
> *(nota)* Dice. Al presente. Nessuno lo corregge.

*(La nota non spiega l'indizio: lo rende **notabile**. Senza, un verbo al presente in mezzo a
una battuta si legge come un refuso, ed era esattamente quello che succedeva.)*

**14 · Il retro della sala.** I due in piedi ai lati di un carrello con il tè, uno di fronte
all'altro. Le sagome degli altri restano di là. Qui la scena è a due colori soli.

> Jae-min: «Com'è successo?»
> Chun-sik: «Un container, al molo 7. Di notte lì non c'è nessuno.»
> Jae-min: «E allora lui cosa ci faceva, al molo 7, di notte?»
> *(nota)* Chun-sik non risponde. Versa il tè.

*(È l'unico pannello in cui Chun-sik ha gli occhi bassi e la bocca chiusa. Quando smette di
parlare vuol dire che sta per succedere qualcosa — [`01-personaggi.md`](01-personaggi.md).)*

**15 · Il tè.** Primo piano: tre tazze, tutte piene.

> Narratore: `Tre tazze. Al tavolo sono in due.`
> *(nota)* Chun-sik se ne accorge a metà. Non toglie la terza.

**16 · Il pacco.** Chun-sik porge un sacchetto di plastica del 편의점 con dentro qualcosa di
scuro.

> Chun-sik: «Prendi. Era di tuo padre. A me non entra da vent'anni.»

**17 · Il bomber.** Sul tavolo, aperto: nero, la banda rossa lungo la schiena, l'artigliata
bianca della tigre. Il colletto è consumato in un punto solo, a destra.

> Narratore: `Sulla schiena, l'artigliata della tigre bianca:`
> `il segno del 백호파, la banda di suo padre.`
>
> Chun-sik: «Non metterlo a Gangnam.»
> Jae-min: «Perché?»
> Chun-sik: «Perché a Gangnam sanno cos'è.»

*(Senza la riga del narratore lo scambio non ha senso: è un giubbotto qualunque, e non si
capisce perché a Gangnam dovrebbero riconoscerlo.)*

**18 · Fuori, sotto la tettoia.** Pioggia fitta. Tre berline nere ferme in doppia fila,
motore acceso, tergicristalli in funzione.

> Narratore: `Fuori dalla camera ardente, in doppia fila.`
> `Tre berline nere, motore acceso. Non scende nessuno.`

**19 · Il finestrino.** Uno dei vetri posteriori scende di dieci centimetri. Dentro, buio.
Non si vede una faccia: si vede **una mano destra che resta in tasca** e una sinistra che
regge una cartellina con l'intestazione `한성개발`.

> Narratore: `Un vetro scende di dieci centimetri. Dentro non si vede una faccia.`
> *(nota)* Una mano regge la cartellina di 한성개발. L'altra resta in tasca. Il vetro risale, e le tre auto partono insieme.

*(Secondo indizio. È Dulchae, ed è l'unico personaggio dell'apertura che **non** ha una faccia
disegnata: il giocatore lo rivedrà, con la stessa mano in tasca, in M8.)*

---

## Parte quarta — la notte (pannelli 20-26)

**20 · Nero.** Un secondo pieno. Scorre da solo.

**21 · Il vicolo.** Jae-min con il bomber addosso, **di spalle**, in un vicolo di Hongdae. Le
insegne si riflettono nell'acqua. In fondo al vicolo, l'unica insegna accesa.

> Narratore: `01:12. Un vicolo di Hongdae, con il bomber addosso.`
> `L'unica insegna accesa è quella del 편의점, il minimarket.`

*(Di spalle apposta: quello che si guarda è il giubbotto. 편의점 si traduce qui, una volta
sola, e da qui in poi è una parola che il giocatore conosce.)*

**22 · Il 편의점.** Interno, luce verde. Il commesso, uno studente, alza gli occhi dal
telefono, guarda il bomber, e si irrigidisce **un attimo di troppo**. Jae-min di spalle in
primo piano: la scena è la faccia del commesso.

> Commesso: «…di nuovo?»
> Jae-min: «Come, scusi?»
> Commesso: *(torna al telefono)* «Niente. Mi scusi. Milleottocento.»
> *(nota)* Ha detto «di nuovo» a uno sceso da un aereo stamattina.

*(Terzo indizio, e il più leggero: qualcuno lo ha già visto. Ieri.)*

**23 · Fuori dal 편의점.** Seduto sul cordolo sotto la tettoia, il sacchetto accanto, mangia.
Sul muro dall'altra parte, un altro manifesto `철거예정`.

> Narratore: `Mangia seduto sul cordolo. Passa una volante, rallenta, non si ferma.`

**24 · L'auto.** Una berlina vecchia parcheggiata storta, con la polvere. Targa:
`서울 12 나 3104`.

> Narratore: `L'auto di suo padre, ferma da mesi.`
> `Le chiavi erano nel sacchetto. Il bollo è scaduto da undici.`

**25 · Dentro l'auto.** Cruscotto. Chiave girata. Il quadro si accende, e con lui la radio.

> Narratore: `Chiave girata. Il quadro si accende, e con lui la radio: 91.3.`
> `Poi la lancetta si sposta di mezza tacca. Nessuno la tocca.`

**26 · Il quadrante, tutto lo schermo.**

> `91.45`
>
> 91.45: «Seo Jae-min. Sei in Corea da diciotto ore e quaranta minuti.»
> Jae-min: «Chi parla?»
> 91.45: «Ho detto qualcosa di sbagliato? No. Allora non è quella la domanda.»
> Jae-min: «…Chi parla.»
> 91.45: «Uno che ha letto il referto.
> Nella bara c'è un uomo di un metro e settantuno. Tuo padre era alto un metro e ottantatré.»

*(La rivelazione va capita **qui**, non a M4: «il referto» dice da dove viene il numero, e i
due numeri in fila dicono il resto senza spiegarlo. Le righe di Kkachi non portano un nome
davanti ma **la frequenza**: è l'indizio principale del settimo colpo di scena, e senza voce
doveva diventare un fatto tipografico.)*

---

## Parte quinta — il titolo (pannelli 27-28)

**27 · Esterno, l'auto ferma nel vicolo, vista da lontano.** Piove ancora. I fari accesi. Non
parte. In fondo al vicolo, un cane bagnato attraversa e sparisce — **lo stesso cane del
pannello 1**.

> Narratore: `La frequenza cade. Sulla 91.3 torna una canzone del 1994.`
> `I fari sono accesi. L'auto non parte.`

**28 · Il titolo.** Sopra la sagoma di Seoul all'alba, con il Namsan a sinistra e le gru di
Gangnam a destra. È l'unico pannello in cui la musica sale.

> **SEOUL CRASHERS**
> *백호 없는 산 — la montagna senza tigre*

---

## Il passaggio di consegne

Stacco. Si apre sul gioco vero: **stessa auto, stesso vicolo di Hongdae, mattina dopo,
`08:24`** — l'ora con cui la partita comincia già oggi. Jae-min ha dormito in macchina. La
pioggia è finita, l'asfalto è ancora bagnato, e l'auto del padre è parcheggiata lì davanti.

Il primo comando che il giocatore può dare è **accendere la radio**. Se lo fa entro il primo
minuto, Kkachi dice una riga sola:

> 91.45: «Bene. Adesso mettiamo in ordine. Guida.»

Se non lo fa, la stessa riga arriva quando sale in macchina la prima volta. Se il giocatore
scende, cammina e non guida, **Kkachi non parla** — e questo è il modo in cui il gioco insegna,
senza scriverlo da nessuna parte, che quella voce sta nel motore.

Da qui parte **M1 · «Il cappotto di un altro»**.

---

## Poggia su

Menu iniziale e «Nuova partita» (§5.18, §5.21) · orologio di gioco e ora d'avvio `08:24`
(§5.11) · pioggia e asfalto bagnato (§5.11) · radio in auto con la manopola `R` (§5.14) ·
tema musicale e stacchi (§5.19) · insegne e neon dei distretti (§5.8) · volanti e sirena
(§5.5) · pannelli, pixel art e lettore (§5.28).

## Chiede ancora

- **Una stazione radio finta a `91.45`** che non stia nella lista delle stazioni vere e non
  dipenda dalla rete. È la **tappa D**: finché non c'è, la riga di Kkachi del passaggio di
  consegne è un `hud.toast`, ed è l'unico punto dell'apertura che quella tappa dovrà toccare.
- **La regia sonora della scena** — il fruscio di banda, la voce che conta, il cane, la sirena
  lontana. La musica c'è (§5.28); questi sono effetti, e conviene farli con la tappa D, dove
  nasce il timbro del fruscio di Kkachi.
