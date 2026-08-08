# Pannelli, cutscene e l'impianto che le regge

> §5.27 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.27 — La tappa A della campagna

La prima tappa della storia (`docs/storia/08-domande-aperte.md`) chiedeva due cose: **le
primitive dei pannelli** e **la cutscene iniziale**. Ne sono uscite quattro, perché due pezzi
d'impianto andavano fatti *adesso* — quando costano cento righe — invece che alla quinta
modalità e alla centesima condizione di missione.

---

**Il bus di eventi (`core/events.js`).** Prima i fatti del mondo si dicevano con otto callback
fissi su `Game` (`onPedKilled`, `onVehicleDestroyed`, …), chiamati da tredici punti fra
`vehicle.js`, `player.js`, `pedestrians.js`, `projectiles.js` e `shops.js`. Funzionava perché
c'era **un solo** ascoltatore: `Game` stesso. Dodici missioni con cinque fasi e due condizioni
per fase fanno un centinaio di inneschi, e a quel modo sarebbero stati un centinaio di `if`
dentro `main.js`.

Adesso i callback ci sono ancora, i chiamanti non sono stati toccati, e ognuno **finisce con un
`emit`**. Chi vuole *osservare* un fatto si iscrive. Due dettagli non sono decorativi: si itera
su una **copia** della lista (un iscritto che si disiscrive mentre viene chiamato è il caso
normale — una fase che si chiude proprio sull'evento che aspettava) e l'eccezione di un
iscritto **non ferma il frame**, perché un innesco scritto male non deve spegnere il gioco a
metà inseguimento.

Gli stessi eventi serviranno **due volte**: alle missioni e alla tabella di Kkachi, che fra i
suoi predicati ha «la prima volta che succede X» (decisione 9).

**La tabella delle modalità (`core/modes.js`).** `paused` era una riga di `main.update` con
quattro `or` dentro, e le modalità del gioco erano dieci booleani sparsi. Ha retto finché erano
due e mezzo: si gioca, c'è un pannello davanti, si guarda il titolo. **La cutscene è la prima
che non è nessuna delle tre**: vuole il mondo fermo come un menu, il giocatore fermo come un
menu, i pannelli che animano come il gioco, e un abbassamento dell'audio suo.

Adesso ogni modalità dichiara cosa concede — `worldRuns`, `playerRuns`, `duck`, `radioDuck`,
`cursor` — e `game.paused` è **derivato** (`!mode.worldRuns`). Chi leggeva `game.paused`
continua a funzionare senza saperlo; `audio.updateBeds` e `radio.contextGain` leggono i due
`duck` dalla tabella invece di avere il numero scritto in casa.

Non è ancora una pila: l'ordine della lista *è* la priorità, e per adesso le modalità non si
sovrappongono davvero (non si apre la mappa dentro una cutscene). Diventerà una pila il giorno
che due si sovrappongono, e quel giorno cambia quel file e nient'altro.

**Il testo su più righe (`ui/text.js`).** Il gioco non ne aveva mai avuto bisogno: HUD, menu e
listini scrivono una riga sola e la accorciano coi puntini. I pannelli sono **solo testo**
(decisione 1) e la stessa decisione dice che se una battuta non ci sta si taglia la battuta,
**non si rimpicciolisce il corpo** — cioè corpo fisso e a capo automatico, così chi scrive il
copione vede subito quando ha esagerato. Il taglio è avido sugli spazi con una via d'uscita a
carattere per il pezzo unico più largo della colonna (una targa, un indirizzo, un blocco in
hangul senza spazi).

---

**Le primitive dei pannelli (`render/panelkit.js`).** Stesso patto degli sprite (§5.4): nessun
asset, tutto path su canvas, un pannello = una funzione. Nel kit ci sono solo i pezzi che
tornano in più pannelli — sagome (nove pose), insegne al neon in hangul, pioggia, asfalto
bagnato, palazzi con le finestre accese, un'auto, il manifesto `철거예정`, il quadrante della
radio, il cane, il narratore e le battute. Il resto se lo disegna il pannello.

**Una deviazione consapevole dal copione:** `08-domande-aperte.md` diceva «una funzione che
disegna su un canvas offscreen». Il senso era «niente asset in cache, si disegna e si butta», e
quello vale ancora — ma un canvas grande allocato a ogni frame per una pioggia che si muove
costa più della pioggia. Si disegna **dritti sul contesto del gioco, dentro un rettangolo
ritagliato**: stesso risultato, meno pezzi, e i pannelli possono animare.

**La cutscene (`ui/cutscene.js`)** non sa niente di quale storia sta raccontando: riceve una
sequenza e la mostra. Le missioni useranno lo stesso oggetto. L'avanzamento è **sempre del
giocatore**, tranne dove non c'è niente da leggere (`hold`, che serve al solo pannello 20): un
pannello che scorre da solo mentre stai ancora leggendo fa saltare tutta la scena a chi
l'avrebbe guardata. `onDone` è quello che succede dopo, e non lo decide questo file.

**I ventotto pannelli (`story/intro.js`).** Il copione comanda: qui non si inventa niente, si
disegna. Tre pannelli non sono decorazione — l'11 (la cicatrice a **sinistra** nella foto, a
destra in tutti i pannelli di ricordo dei tre atti), il 19 (la **mano destra in tasca**, che è
Dulchae e torna in M7 e M8) e il 26 (la prima frase di Kkachi, che torna in M4 e R4) — e stanno
scritti in testa al file perché nessuno li «semplifichi».

**Il passaggio di consegne.** L'ora era già quella giusta (`DayCycle.startHour` è 8.4, cioè
`08:24`), quindi restavano l'asfalto ancora bagnato, l'auto del padre e la prima riga di
Kkachi — che arriva **solo se il giocatore accende la radio o sale in macchina**, mai a piedi.
È il modo in cui la scena insegna, senza scriverlo da nessuna parte, che quella voce sta nel
motore. È anche la prima cosa del gioco costruita sul bus, ed è servita a provarlo.

---

**Il provino, e perché serviva.** Metà dei pannelli, alla prima passata, erano **nero su nero**:
nel sorgente si leggevano benissimo (un giubbotto `#0a0b0f` su un tavolo `#22262e` *è* un
contrasto), a schermo erano un rettangolo vuoto. Guardarli uno per uno significava ventotto
avvii; `.claude/tools/scenes/cutscene-sheet.scene` li disegna **tutti in una griglia sola** e in
uno scatto si vede quali sono macchie. Ha trovato anche un errore che sarebbe uscito solo al
ventottesimo pannello (un import mancante) e, indirettamente, l'auto del padre che nasceva a
coordinate `NaN`. Vale per ogni atto che verrà.
