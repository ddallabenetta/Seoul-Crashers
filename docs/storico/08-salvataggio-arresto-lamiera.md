# Salvataggio, arresto e lamiera solida

> §5.15–5.17 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.15 Il salvataggio: tre slot, 0,7 kB

Era la prima voce del §6: con del denaro in tasca, un arsenale comprato, un orologio che
avanza e degli interni che si ricordano, chiudere la pagina buttava via tutto.

**Il salvataggio è piccolo perché la città è deterministica.** Strade, edifici, vetrine,
officine e territori nascono da `new Rng(20260730)` e sono identici a ogni avvio: non hanno
bisogno di stare in un file. Traffico e pedoni sono streaming puro attorno al giocatore, e si
rifanno da soli. Resta **solo quello che il giocatore ha cambiato** — sé stesso, il mezzo che
stava guidando, l'orologio col suo meteo, il ricercato, le statistiche e le poche cose che gli
interni ricordano. Misurato: **0,7 kB per slot**, e il conto non cresce con la mappa.

Le scelte, tutte in `src/core/save.js`:

- **Tre slot manuali dal menu di pausa, nessun autosave.** Salvare in tre punti a scelta è una
  decisione del giocatore; un autosave che scatta da solo mentre hai quattro stelle addosso è
  una trappola. Sovrascrivere e cancellare vogliono **due Invio**.
- **Salvando dentro un negozio si registra la vetrina, non la pianta.** Le coordinate di un
  interno sono numeri da 200-470 px che in città cadono tutti nell'angolo nord-ovest della
  mappa: è la stessa trappola di `wanted.add` (§4). Si ricarica in strada, davanti alla porta.
- **Il mezzo si salva come descrizione** (tipo, colore, HP, gomme) e alla ricarica ne nasce uno
  nuovo sotto il giocatore, con `protect` scritto a mano perché non ci passa `onEnterVehicle`.
  Salvare la lista dei veicoli vorrebbe dire salvare mezza città per riavere l'auto in cui eri
  seduto.
- **Il ricercato si conserva.** Chi salva in mezzo a un inseguimento lo ritrova: è coerente con
  una porta che non è mai stata un nascondiglio (§5.8).
- **Gli interni restano pigri.** Il salvataggio ricorda per ogni indirizzo la cassa svuotata e
  il personale steso; `shops.interiorOf` applica il ricordo **alla prima visita dopo il
  caricamento** (`shops.pending`), invece di ricostruire 369 piante che nessuno guarderà. I
  clienti ammazzati restano fuori: la folla di passaggio nasce dall'ora che è, quindi un indice
  su quella lista non vorrebbe dire niente al caricamento.
- **Uno slot con una seed diversa viene rifiutato.** Una modifica alla generazione sposta tutto
  quello che c'è a valle, e il giocatore rinascerebbe dentro un muro. **Se tocchi `citygen`,
  i salvataggi vecchi devono smettere di caricarsi** — è quello che fa il controllo su `SEED`.
- **Il caricamento svuota il mondo prima di spostare il giocatore e lo ripopola dopo.** Al
  contrario ci si porterebbe dietro il traffico del punto di partenza. Costa **2,7 ms** e non
  lascia strascichi: 36 fps prima, 37 sei secondi dopo.

Quello che *non* è nel file, e va bene così: raccolte a terra (ricompaiono da sole, e
`pickups.reset()` le rimette tutte in campo al caricamento), stato del traffico, posizione dei
pedoni, mix audio e stazione radio (che hanno già una chiave `localStorage` loro).

### 5.16 Arresto: la divisa ammanetta invece di sparare

Seconda voce del §6, rimandata dalla tappa B con una ragione scritta in §5.5 — il busted
raddoppia i flussi di fine partita. Qui il flusso in più è **uno solo**, e riusa quello che
c'era già: `player.revive` confisca l'arsenale come in corsia, `daycycle.advance` fa passare le
ore come il letto della safehouse, i commissariati esistono dal §5.12.

**Quando si viene ammanettati.** La divisa smette di sparare e chiude la distanza in due
situazioni sole: hai in pugno **i pugni o una mazza** — sparare a chi non ha una bocca da fuoco
non è quello che fa una pattuglia — oppure sei **quasi a terra** (HP ≤ 25), e allora il fermo è
la strada corta. Sopra le **tre stelle** non arresta più nessuno, e la SWAT non arresta mai: a
quel punto in strada ci sono speronamenti, chiodi ed elicottero, e fermarsi ad ammanettare
sarebbe un passo indietro nell'escalation. È anche quello che rende il fermo **una scelta del
giocatore** invece di un incidente: mettere via la pistola con una stella è una resa, con
cinque non serve a niente.

**Il cronometro sta sul sistema, non sull'agente** (`police.bustT`): la condizione è del
giocatore, e che si arrenda o no non dipende da quale pattuglia gli è addosso. 1,4 s con un
agente entro 46 px, e si spezza in quattro modi che sono tutti azioni — allontanarsi, salire in
macchina, tirare fuori una bocca da fuoco, stendere l'agente. Il contatto si perde al doppio
della velocità con cui si guadagna: due passi indietro devono bastare.

**Cosa costa, e perché non è la morte.** Deve costare in modo *diverso*, o tanto varrebbe
morire: l'ospedale si prende un quarto dei contanti e ti rimette in piedi subito, la cella si
prende **un quinto** (la cauzione) ma **sei ore**. Perdere una notte di Seoul è un prezzo che il
gioco sa già far sentire — cambia la luce, cambia il tempo, chiudono i locali — e non ne
serviva uno nuovo. L'orologio va **fatto girare** con `advance`, non spostato, o il meteo
all'uscita sarebbe quello di quando sei entrato (§4). Ci si sveglia davanti al commissariato più
vicino, che è finalmente qualcosa che i commissariati *fanno*; dove non ce ne sono (campagna,
aeroporto) ti portano all'ospedale del distretto.

L'HUD mostra la barra che si riempie e cosa fare per spezzarla: un secondo e mezzo senza niente
a schermo sarebbe un fermo che arriva dal nulla. Sta **sotto il centro** e non nel terzo alto,
che è già occupato da cartello del distretto e messaggi.

### 5.17 La lamiera è solida anche a piedi

**Segnalazione dell'utente:** *«il giocatore si compenetra con le auto e può camminarci
sopra»*. `player.resolveCollisions` interrogava solo `area.grid` — edifici, props solidi e
limiti: i veicoli non ci sono mai stati, in nessuna fase. In una visuale dall'alto, dove il
tetto di un'auto è disegnato più in alto del marciapiede, il risultato non era «lo attraverso»
ma «ci cammino sopra», che è peggio.

- **La sagoma sono i tre cerchi di `collisionCircles`** (ora esportata da `vehicle.js`), gli
  stessi con cui i veicoli si urtano fra loro. L'ingombro rettangolare no: di quello, una
  berlina in diagonale sporgerebbe con gli angoli.
- **Si risolve solo il cerchio più compenetrato.** Sommare i tre spara via il giocatore, ed è
  la stessa ragione per cui lo fa la fisica dei veicoli (§4).
- **Le lamiere prima dei muri.** Nell'ordine inverso, un'auto che ti stringe contro una vetrina
  ti spingerebbe *dentro* la vetrina, che è l'unico dei due modi di restare incastrato che si
  vede a schermo.
- **Da fermo spinge, in corsa investe**: la stessa collisione letta due volte. Il danno guarda
  **solo quanto la lamiera avanza verso di te**, non la velocità relativa — altrimenti
  sprintare addosso a un'auto in sosta farebbe male, e in una città di macchine parcheggiate ci
  si sbatte di continuo. Sotto i 70 px/s (21 km/h) spinge e basta; sopra fa `(v − 70) × 0.3` di
  danno, al massimo uno ogni mezzo secondo perché un'auto che ti trascina contro un muro non
  applichi il danno sessanta volte al secondo.

Misurato headless: dal centro di una berlina si viene espulsi a 24 px (il minimo geometrico),
un furgone a 90 km/h toglie 58 HP, sprintare contro una lamiera ferma ne toglie 0 e ci si ferma
a 52 px dal centro. Fermi su un marciapiede per 45 s in mezzo al traffico: **nessun danno
spurio**.

> I **pedoni** invece attraversano ancora le auto in sosta, ed è voluto per adesso: un pedone
> che si incastra contro una macchina parcheggiata mentre attraversa resterebbe lì per sempre,
> e il rimedio (aggirare l'ostacolo) è lavoro di steering, non di collisione. Sta nel §6.
