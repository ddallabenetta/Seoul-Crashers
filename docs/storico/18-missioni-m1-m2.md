# L'impianto delle missioni, M1 e M2, e il filo del 병원

> §5.29 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../../HANDOFF.md).

### 5.29 — La tappa B: due missioni intere, e il motore che le regge

La tappa A (§5.28) aveva messo a schermo la prima cosa della campagna. Questa mette a schermo
la prima cosa **giocabile**: due missioni complete, una in strada e una in un interno, con
l'impianto che le fa girare e che dovrà reggere le altre dieci.

Il criterio è lo stesso di sempre: quello che vale per tutte e dodici sta nel motore e non
nelle missioni, e quello che sa la trama sta sotto `src/story/` e in nessun altro posto.

---

## 1. Il motore (`core/missions.js`)

Una missione è una **fila di fasi**, e una fase è una funzione che *apparecchia*, non un ciclo
che controlla: `enter` mette il blip, i punti interattivi e le iscrizioni al bus, poi la fase
dorme finché non succede il fatto che aspettava. `tick` esiste per le poche condizioni che un
evento non sa dire — essere arrivati in un posto, tre secondi passati — e per quelle sole.

Tre decisioni prese con l'utente ([`storia/08-domande-aperte.md`](../storia/08-domande-aperte.md))
sono cablate lì dentro, perché valgono per tutte:

- **un blip solo.** Il marcatore ha sempre lo stesso id, quindi `setMarker` lo *sposta* invece
  di accumularne (§5.27). L'invariante è verificata dalla scena: i marcatori a schermo non
  passano mai da uno;
- **il fallimento riparte dall'ultima fase**, non dalla missione. Ci si iscrive a `respawn` e
  `busted` e non a `playerDeath`, perché quando quei due arrivano il giocatore è **già stato
  spostato**: rientrare prima vorrebbe dire apparecchiare la fase attorno a un cadavere;
- **le cutscene non si rivedono mai due volte.** `seen` è un elenco di sequenze già giocate, sta
  nel salvataggio, e vale sia per la ripresa dopo una morte sia per un caricamento.

**Tutto quello che una fase apparecchia viene smontato da sola.** `ctx.on` e `ctx.point` si
disfano al cambio di fase: senza, una missione ripresa tre volte lascerebbe tre iscritti sullo
stesso evento e il terzo pegno si raccoglierebbe da sé. È la ragione per cui il contesto (`ctx`)
si ricostruisce a ogni chiamata invece di essere un oggetto tenuto da parte — una fase morta non
può spostare il blip di quella dopo.

Nel salvataggio va **la posizione nella storia**, non la storia: missione, fase, taccuino della
fase, e le tre liste che non devono ripetersi (fatte, viste, fatti acquisiti). Sono 122 byte, e
il ripristino **rientra nella fase** invece di saltarla — lo stesso percorso della ripresa dopo
una morte, ed è voluto che sia lo stesso.

## 2. Il dialogo (`ui/dialogue.js`)

`core/modes.js` aveva previsto questa modalità e nessuno l'aveva ancora scritta: mondo fermo
come in un menu, giocatore fermo come in un menu, e **la città che resta a schermo sotto il
riquadro**. Serviva: metà del copione delle missioni sono scambi di due righe nel posto in cui
succedono, e coprire quel posto con una tavola disegnata a mano toglie la sola cosa che li
distingue da una cutscene.

Costa una riga in `MODES` (`duck` 0,4 invece di 0,12, perché il mondo si vede ancora) e un
riquadro. Non si salta: due battute si leggono.

## 3. Tre cose che il motore non aveva, e che una missione pretende

**Un personaggio nominato dentro un edificio.** `ActorSystem` (§5.27) non entrava nei negozi,
per una ragione buona — lì `game.peds` è scambiato con la gente del piano. Ma Jo Ok-bun *sta*
dietro un banco, e Chun-sik *sta* in una sala biliardo. Adesso una definizione può dichiararsi
`indoor`, e allora non è lo streaming a occuparsene ma il piano: `shops.refreshCrowd` chiede
a `actors.populate` chi c'è, il pedone **non si ricostruisce** fra una visita e l'altra (quindi
si ritrovano le stesse ferite, la stessa posizione e lo stesso morto per terra), e un attore
resta al suo posto anche a locale chiuso — uno che ti aspetta ti aspetta.
Chi non conosce in anticipo le coordinate della pianta — ed è il caso normale, perché le piante
sono generate — passa `place(floor)` e le riceve la prima volta che quel piano viene aperto.

**Una porta tenuta aperta dalla storia** (`shops.hold`). È il contrario esatto di `seal`
(§5.27), e nasce da un problema che si sarebbe ripresentato a ogni missione: il 당구장 apre alle
15, il 술집 alle 17, il 노래방 alle 16, e M1 comincia alle `08:24`. Non è una svista del
copione — in quella sala si conta il pizzo di martedì mattina a saracinesca abbassata — ma senza
un modo di dirlo metà campagna andrebbe spostata all'ora di apertura di un negozio. `hold` apre
l'**indirizzo**, non il piano, perché quello che è aperto è il portone e la scala è del palazzo.
Sta nel salvataggio come i sigilli.

**Tre eventi in più sul bus**: `shopEnter`, `shopLeave`, `floorShown`. L'ultimo è quello che
serve davvero: `showFloor` è il varco unico per arrivare su un piano — porta, scala, risveglio
dal futon — quindi è l'unico posto da cui una fase può sapere dove sei.

## 4. Dove succedono le cose (`story/places.js`)

Il copione dice «un 당구장 a Hongdae» e non può dire di più: la città nasce da una seed e
nessuno ha scelto a mano quale palazzo. **La storia non piazza niente: cerca.** La ricerca è
deterministica (stessa seed, stessi indirizzi), e non sta nel salvataggio apposta — ricavare un
indirizzo è più sicuro che ricordarselo, perché uno salvato sopravviverebbe a una modifica della
generazione e punterebbe a un palazzo che nel frattempo è diventato un altro.

Il rischio vero non è trovare l'indirizzo sbagliato: è **non trovarne nessuno** e lasciare una
fase senza obiettivo. Quindi ogni ricerca ha un ripiego che allarga il criterio (fuori
quartiere, senza distanza minima) invece di restituire `null`.

## 5. Le due missioni

**M1 · «Il cappotto di un altro»** — otto fasi, cinque pannelli. Insegna a guidare e a entrare
in un posto; il secondo punto dice la riga che vale tutta la missione («ha già ritirato ieri
sera. Lei. Ieri.») e il terzo **non paga**: è una serranda col sigillo di perizia, ed è il primo
muro della storia. Resta sigillata per il resto della partita.

**M2 · «Quello che resta in pegno»** — nove fasi, cinque pannelli. Insegna la città a piedi con
tre pegni sparsi, che sono **una fase sola con tre caselle** e non tre fasi: l'ordine lo sceglie
il giocatore e il blip segue quello che gli è rimasto più vicino, che è cosa vuol dire «un blip
solo» quando gli obiettivi sono tre. La rapina al banco non è una scena scritta a mano: sono due
pedoni normali messi nella gente del piano, quindi mischia, raggi, magnetismo di mira e onda
d'urto li trovano senza sapere niente di questa scena.

Due personaggi nuovi a pixel: **Jo Ok-bun** (occhi chiusi **nella griglia**, non
nell'espressione — è cieca, e nei pannelli non li apre mai) e **Jeong Han-su** (gli occhiali
sono la sua faccia, e il camice è l'unico vestito chiaro del cast).

## 6. Il filo del 병원

Fuori dalla fila delle tappe, e agganciato qui perché **si accumula per tutta la partita**: se
arrivasse alla fine, tutte le morti fatte prima sarebbero state mute per niente. È tutto testo
appeso a `respawn`, che esiste dal §5.27.

Il conto delle morti **non è un contatore nuovo**: è `stats.deaths`, che il gioco tiene dal
§5.15 e che il salvataggio porta già. Averne due vorrebbe dire averne uno sbagliato, e la scena
di M12 poggia su quel numero. Quasi tutti i risvegli sono una riga in coda al messaggio
dell'ospedale; quattro sono un pannello (il primo, il terzo, il decimo, il primo dopo M12) e si
chiudono da soli, o diventano una cosa da saltare a memoria. Le battute non si ripetono mai:
finite quelle, si passa alla forma con il numero.

La scena dopo M12 è scritta e cablata: aspetta solo che qualcuno alzi il flag `m12`.

---

## Quello che questa tappa ha trovato a schermo, e non nel sorgente

Cinque pannelli su dieci sono stati rifatti dopo il primo provino, e nessuno dei cinque si
leggeva come sbagliato nel codice:

- **il vicolo di M1 era nero.** Un `wash` chiaro con sopra quattro `block` che coprono dal 6%
  in giù non è «un vicolo in ombra», è uno schermo spento: il cielo va lasciato scoperto in
  mezzo, o la mattina dopo somiglia alla notte prima. E l'auto aveva una scala di `P.h * 0.0042`
  invece di `P.w * 0.46` — `car()` vuole la **lunghezza in pixel**, non un fattore;
- **Jo Ok-bun era un cappello.** Il bancone disegnato *dopo* la figura le arrivava alla fronte.
  Chi mette un personaggio dietro un mobile disegna il mobile per secondo, sempre;
- **l'incisione `구만기` non si leggeva**: nove cerchi concentrici passavano sotto il nome, e
  la lumeggiatura era una seconda passata sovrapposta invece che spostata di un pixel in su. È
  un pannello che ha **un solo lavoro** — far leggere quel nome — e lo mancava;
- **i nove oggetti dello scaffale erano nove trattini.** Vanno contati (in M10 ne arrivano altri
  nove, in M12 fanno diciotto), quindi devono essere grandi;
- **quattro dita in fila sono uno steccato.** Ci vogliono i polpastrelli arrotondati e un
  pollice di lato, o non è una mano.

## Poggia su

Bus di eventi, tabella delle modalità, migrazioni del salvataggio, attori nominati, porte
sigillate e marcatori (§5.27) · lettore di pannelli, `panelkit`, `pixelkit` e le sei regole di
scrittura (§5.28) · negozi, piani e orari (§5.8, §5.11) · risveglio in corsia (§5.16) ·
cortili delle bande (§5.12) · rapine spontanee (§5.26).

## Chiederebbe

- **Kkachi**, che è la tappa D: le tre righe della radio di M1 e M2 sono `hud.toast` finché non
  esiste la stazione `91.45`, e sono l'unico punto di queste due missioni che quella tappa dovrà
  tornare a toccare.
- **Un oggetto di missione trasportabile.** I tre pegni di M2 sono tre caselle in un taccuino,
  non tre cose in mano: non si vedono addosso e non si possono perdere.
- **Un pedinamento con soglia di distanza** («ti ha visto / l'hai perso»), che M3 chiede subito e
  che torna in M6 e M9.
- **Una risposta diversa da Jo dopo M6** (le «visite che cambiano»,
  [`storia/07-radio-kkachi.md`](../storia/07-radio-kkachi.md)): oggi il banco dice sempre le
  stesse cose una volta finita M2.
