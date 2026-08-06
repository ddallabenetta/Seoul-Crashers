# Fase 2 — combattimento, polizia, arsenale pesante

> §5.4–5.7 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.4 Fase 2, tappa A — combattimento base

Le quattro scelte di design sono state decise con l'utente prima di scrivere codice:
combattimento prima del ricercato, **mira libera col mouse più magnetismo**, morte con
**risveglio all'ospedale e perdita dell'arsenale**, **drive-by solo con le armi leggere**.

- **Scalinate (계단)** (`citygen`, sezione "Scalinate"). Una scalinata non è geometria nuova:
  è un **vicolo passante** (`yard.through`) la cui pendenza supera `STAIR_GRADE`, più un solido
  `vehicleOnly` sopra. Sono candidati solo i vicoli `through` — quelli di cortile (`block.alleys`)
  portano ai parcheggi, e murarli lascerebbe le auto in sosta senza uscita.
  **Ne escono 8, e il tetto è 14**: tanti sono i vicoli passanti in tutta la città. Il collo di
  bottiglia non è la pendenza, è il numero di varchi: per averne di più bisogna toccare
  `fillUrbanBlock`, che consuma rng diverso e **ridisegna tutta la città**. Ne vale la pena solo
  se si accetta di rifare la messa a punto del traffico.
- **Armi** (`weapons.js`). Pugni e mazza (mischia a cono), pistola e SMG (raycast). La tabella
  `WEAPONS` tiene danno, cadenza, dispersione, gittata e scorta massima. La mischia colpisce il
  primo pedone nel cono, e se non c'è nessuno prende a mazzate la carrozzeria.
- **Mira col mouse.** A piedi il personaggio **guarda sempre il cursore** e cammina di lato:
  è metà del combattimento in una visuale dall'alto. Il mirino lo disegna l'HUD (`cursor: none`
  sul canvas, il cursore di sistema torna solo nei menu).
- **Drive-by.** Solo pistola e SMG, cadenza × 1.5 e dispersione × 2.4 che peggiora con la
  velocità. Il proprio veicolo è escluso dal raycast (`ignoreVehicle`), altrimenti si spara sul
  proprio cofano.
- **Salute e morte.** 100 HP, vignettatura rossa sui colpi e pulsante sotto il 30 %, schermata
  `사망` e dopo 2.8 s risveglio all'ospedale del distretto più vicino: HP pieni, **arsenale
  perso** (restano i pugni). Un ospedale per distretto, sul marciapiede dell'isolato grande più
  vicino al centro, con la croce dipinta a terra e il blip su minimappa e mappa.
- **Pedoni che reagiscono.** Ogni sparo chiama `game.alarm`: chi è nel raggio scappa, e i
  teppisti vicini al giocatore diventano `hostile`. Un ostile armato tiene la distanza di tiro
  se ha la linea libera, altrimenti corre a chiuderla; uno disarmato carica e mena. Gli ostili
  hanno un anello rosso sotto i piedi e un puntino sulla minimappa — nella folla un teppista in
  nero è identico a un passante finché non spara.
- **Tono crudo.** Schizzo di sangue nella direzione del colpo, pozza persistente, scia mentre
  il ferito scappa, ragdoll che scivola e gira. L'esplosione di un veicolo fa danno in un
  raggio di 100 px a pedoni e giocatore.
- **Raccolte a terra** (`pickups.js`). 42 in tutta la città nei cortili e nei vicoli, più due
  garantite davanti alla safehouse; ricompaiono dopo 55 s. Senza negozi (fase 3) sono l'unico
  rifornimento, quindi non possono sparire per sempre.

### 5.5 Fase 2, tappa B — polizia e ricercato

Le scelte di design che nel piano precedente erano "da concordare" sono state prese qui, e
sono queste (se l'utente ne vuole altre, sono tutte in `wanted.js`, in cima):

- **Cosa alza il livello.** Ogni reato pesa in punti: rissa 1.5 · sparo 3 (al massimo uno
  ogni 0.55 s, altrimenti una raffica di SMG varrebbe cinque stelle in un secondo) · auto
  rubata a un testimone 6, a una pattuglia 12 · agente ferito 12 · veicolo fatto saltare 18 ·
  morto 24 · agente ammazzato 60. Soglie a 10/24/52/92/145. Tradotto: quattro colpi in strada
  = una stella, un cadavere = due, un poliziotto steso = tre (quattro se avevi già scaldato).
  Il furto d'auto è l'unico reato che **vuole un testimone**: rubare un'auto vuota in un
  vicolo non lo denuncia nessuno.
- **Come scende.** Solo non facendosi vedere: `COOL_TIME` va da 7 s (una stella) a 26 s
  (cinque). Un'auto veloce non basta, serve rompere la linea di vista — vicoli, scalinate,
  palazzi. La morte azzera tutto (svegliarsi in ospedale con quattro stelle addosso sarebbe
  una condanna senza uscita); il pay-n-spray arriva in fase 3.
- **Niente arresto.** Il "busted" raddoppierebbe i flussi di fine partita (celle, cauzione,
  arsenale confiscato) per aggiungere poco a una tappa che è già lunga: la polizia spara e
  basta, e la sconfitta resta una sola, l'ospedale. È il primo candidato se si vuole ampliare.
- **Scala delle unità** (`police.TIERS`): 1 → tre agenti a piedi · 2 → due volanti, e
  l'equipaggio scende quando sei a piedi · 3 → speronamenti e colpi dal finestrino · 4 →
  posti di blocco e strisce chiodate · 5 → SWAT con SMG ed elicottero col riflettore.
- **Chiodi.** `flatTires` toglie il 40 % di velocità massima, il 28 % di grip e fa tirare da
  un lato (`flatPull`); i cerchioni fanno scintille (`main.emitSkids`). Non si riparano: si
  cambia macchina.
- **Elicottero.** Orbita largo sopra il giocatore, il riflettore lo insegue **più lento del
  velivolo** — si può uscire dal cono, ed è quello che rende sensato scappare. Abbattibile
  (260 HP): esplode, e ne arriva un altro dopo 40 s.
- **Blip e stelle.** Stelle 수배 sotto il pannello vitale (l'ultima lampeggia mentre stai
  seminando: è l'unico modo che ha il giocatore di sapere che nascondersi funziona), agenti in
  blu su minimappa e anello blu a terra, blocchi e chiodi su minimappa e mappa piena.

### 5.6 Il protagonista

Il vecchio sprite del giocatore era un pedone generico col flag `hero`: da sopra restava una
calotta scura, indistinguibile da un teppista. Ora c'è `getHeroSprite(frame, pose)`, disegnato
apposta e più grande di tutti gli altri (40×34 contro 34×30):

- **tronco trapezoidale** — spalle larghe davanti, vita stretta dietro: è la forma che dice
  "persona, e guarda da quella parte" meglio di qualsiasi dettaglio;
- **banda rossa lungo la spina dorsale**, che a colpo d'occhio è anche una freccia, con
  l'artigliata bianca della tigre (백호, la gang del padre) sopra;
- **testa piccola e spostata in avanti**, con fascia rossa in fronte, ciuffo decolorato,
  rasatura ai lati e un filo di luce sul cranio (senza, la testa nera spariva dentro il
  bomber nero);
- **due pose**: con un'arma da fuoco le braccia si tendono verso il mirino (`pose: 'aim'`),
  altrimenti oscillano. L'arma ora si disegna **sopra** la sagoma, non sotto.
- **ritratto nell'HUD** (`getHeroPortrait`), che pulsa di rosso quando si incassa: è quello che
  dà una faccia al personaggio, visto che a schermo è alto venti pixel.

Le divise hanno avuto lo stesso trattamento minimo ma indispensabile: berretto blu e bretelle
catarifrangenti (`PED_KINDS.cop`), nero opaco e piastra antiproiettile per la SWAT.

### 5.7 Fase 2, tappa C — arsenale pesante ed esplosivi

Sette armi nuove più tre esplosivi, e i tre pezzi di sistema che li reggono (barra armi,
proiettili veri, onda d'urto condivisa). Le scelte di design prese qui — se l'utente ne vuole
altre, cambiare costa poco e i punti sono tutti indicati:

- **Barra armi a sei file** invece di un tasto per arma (§3). L'alternativa scartata era una
  ruota alla GTA V: costa un pannello modale e un input nuovo per risolvere un problema che
  sei file risolvono con i tasti che già c'erano. Sta in `WEAPON_SLOTS`, si riordina in
  trenta secondi.
- **Il fucile di precisione trapassa due bersagli** e col tasto destro **allarga** il campo
  (`scope: 2.3`) invece di stringerlo. Sparato all'anca la dispersione è ×9: senza quel
  malus sarebbe una pistola che uccide in un colpo a 1900 px.
- **La minigun costa mobilità e tempo**: `heavy: 0.56` (si cammina, non si corre) e
  `spinUp: 0.8` s prima del primo colpo, con l'anello del mirino che si chiude a dirlo. È
  l'unico modo di avere 600 colpi senza cancellare il gioco.
- **La pompa** tira otto pallini con `knock: 210`: a due passi stende, a mezzo isolato
  fa il solletico. `pellets` c'era già dalla tappa A e non è stato toccato.
- **Le mine non sono un solido `vehicleOnly`** — il piano della tappa B lo ipotizzava, ma una
  mina che *ferma* un'auto invece di saltare non è una mina. Sono un innesco di prossimità
  (32 px per i veicoli, 18 per chi va a piedi) che **si arma solo quando chi l'ha posata si
  allontana di 62 px**: piazzarne una ai propri piedi e morire non è una meccanica, è un
  incidente. Dall'auto si sgancia dalla coda, che è metà del motivo per averla.
- **La molotov non fa danno d'impatto**: lascia una pozza che brucia 9,5 s a 26 dps, fa
  scappare i pedoni intorno, danneggia anche i veicoli fermi dentro e lascia una bruciatura
  permanente sull'asfalto. La granata invece ha miccia 2,2 s, rimbalza e rotola.
- **Esplosivi ammessi al drive-by** (molotov, granata, mina), fucile d'assalto, sniper e
  minigun no (`driveby: false`): dal finestrino si tiene quello che si tiene con una mano.
- **La SWAT è passata al fucile d'assalto.** Misurato: un giocatore fermo a cinque stelle
  moriva in 10,3 s con la SMG, ora in 8,2 s. È l'escalation che tiene il passo dell'arsenale
  nuovo; se sembra troppo, è una parola in `police.spawnCar`/`spawnFootCop`.
- **Il mirino mostra il raggio dello scoppio** dove cadrà il lancio, e la barra armi dice
  cosa hai e cosa ti manca. Senza questi due, undici armi diventano un menu da imparare a
  memoria.
- Le raccolte a terra ora coprono tutto l'arsenale (`pickups.TABLE`, sniper e minigun rari),
  più una molotov garantita davanti alla safehouse per poter provare la tappa subito.
- **Morte e mine**: `respawnPlayer` chiama `projectiles.clear()`. Senza, ci si sveglia in
  ospedale con il quartiere minato e nessun modo di saperlo.
