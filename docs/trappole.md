# Trappole già pagate

> §4 e §4bis del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 4. Trappole già pagate — non reintrodurle

Ognuno di questi è costato una sessione di diagnosi. Sono tutti risolti; il commento nel
codice spiega il perché nel punto giusto.

| Sintomo | Causa | Dove |
| --- | --- | --- |
| L'auto accelera lentissima (22 km/h dopo 3 s) | `speed` riproiettato dal vettore velocità ogni frame: si sottraeva il ritardo del grip a ogni passo | `vehicle.js`, guardia `v._hit` |
| Auto ammassate e girate a caso agli incroci | rimbalzo elastico costante + torque alto, sommati su 9 coppie di cerchi | `applyImpact` (restituzione in funzione dell'urto), risoluzione della sola coppia più compenetrata |
| Metà del traffico fermo con gas a tavoletta e "libero" | al cambio arco `ai.s` non veniva riproiettato: il waypoint finiva fuori strada e l'auto si piantava, e il ramo di recupero saltava car-following e anti-ingorgo | `traffic.driveAI`, `projectS()` |
| Traffico che si congela progressivamente | incroci senza semaforo senza regole di precedenza | `roadgraph` `claimAxis/claimT` + prenotazione in `driveAI` |
| Auto che tagliano la curva e finiscono nel muro | velocità in svolta troppo alta | `driveAI`, target 64 e anticipo 175 px |
| Arredo urbano in mezzo alla carreggiata | `decorateBlockEdges` posizionava i props *fuori* dall'isolato: il marciapiede è la fascia **interna** | `citygen.decorateBlockEdges` |
| Auto parcheggiate intrappolate | i cortili perimetrali erano chiusi su quattro lati | vicoli in `fillUrbanArea` + `collectParkingSpots` accetta solo aree raggiungibili |
| Nessuna insegna visibile | dimensioni calcolate in spazio texture (anisotropo 64×160) invece che in pixel di mondo | `scene.drawBuilding`, blocco insegne |
| Lampione deformato in un bastone | lo sprite veniva stirato lungo il vettore di proiezione, lampada compresa | `scene.drawProp`, palo disegnato a mano |
| Pedoni investiti a raffica | camminavano a 10 px dal cordolo e attraversavano senza guardare | `sidewalkPoint` (0.78 × SIDEWALK) + `crossingIsSafe` |
| Traffico che appare solo lontano | spawn con anello circolare su archi scelti a caso in tutta la città | `graph.edgesNear` + `outsideView` |
| Un isolato = un solo scatolone | i lotti "da manuale" del distretto (62–130 px) ci stanno una volta sola in un isolato da 130 px | `fillUrbanArea`, helper `lot(span)` che rapporta i lotti all'isolato |
| Auto ferme al semaforo che rotolano all'indietro | la gravità della pendenza applicata anche da fermo e senza gas | `updateVehicle`, guardia `speed > 3 \|\| throttle` |
| Vicoli ciechi ovunque dopo i superblocchi | un tratto che finisce dove la trasversale è stata tolta: l'AI ci fa inversioni a U | `citygen.trimDeadEnds` + lungofiume promossi ad arterie |
| Hillshade invisibile sull'asfalto | `soft-light` non morde su colori molto scuri (#34373d) | `ground.drawRelief` usa `overlay`; la mappa, che è chiara, usa `soft-light` |
| Modifiche che "non fanno niente" | cache euristica del browser sui moduli ES (vedi §1) | cambiare origine: `127.0.0.1` invece di `localhost` |
| Teppista armato che non spara mai e avanza al rallentatore | teneva la distanza di tiro anche **senza** linea di tiro: restava a mirare un muro | `pedestrians` case `hostile`, `los` calcolata ogni frame: senza LOS corre a chiudere |
| Un tap secco del mouse non spara con le automatiche | `mouse.down` è già tornato false se click e rilascio cadono nello stesso frame | `player`, il fuoco guarda `mouse.pressed \|\| (auto && mouse.down)` |
| Quattro colpi sparati in strada non fanno mai una stella | sotto la prima stella l'heat si scaricava a 3/s: ogni sparo evaporava prima del successivo | `wanted.update`, decadimento a 0.6/s |
| Volanti che si accumulano finché il gioco non annaspa | dopo lo sbarco la volante restava "viva" ma non contava come unità in caccia, e ne nasceva un'altra a ogni sbarco | `police.reinforce`: tetto sul **totale**, non sulle sole volanti attive; `addCop` ha il suo |
| Una volante vuota che ti sperona | dopo `deployCrew` la macchina continuava a girare la sua AI | `police.driveCar`, uscita anticipata su `v.deployed` |
| Muri invisibili dove c'era stato un posto di blocco | `SpatialGrid` non aveva rimozione: le transenne restavano nella griglia per sempre | `SpatialGrid.removeRect` + `police.removeBlock` |
| I chiodi non comparivano mai in un inseguimento | si mettevano solo dopo aver piazzato *tutti* i posti di blocco previsti, e uno ogni 7 s | `police.manageObstacles`, blocchi e chiodi si alternano |
| Il protagonista sembra un casco generico | testa grande e centrata sopra un'ellisse: da sopra restava solo una calotta scura | `getHeroSprite`: tronco trapezoidale con spalle larghe, testa piccola spostata avanti, banda rossa lungo la schiena |
| I fari della polizia accecano in pieno giorno | `lightsOn = true` fisso sulle volanti | `police.spawnCar`, `lightsOn = game.isNight` come per il traffico |
| Le icone della barra armi sembrano caselle vuote | le armi sono disegnate quasi nere (`#1a1c20`) su un pannello scuro | `getWeaponIcon` le schiarisce con `source-atop`, che tinge i pixel già disegnati e conserva la sagoma |
| La barra armi finisce sotto il suggerimento «E — sali in…» | il suggerimento è ancorato a `h-62` | barra a `h - CH - 76` in `hud.drawWeaponBar` |
| **In una prova scriptata** il colpo non colpisce mai | `player.angle` a piedi è riscritto ogni frame verso il cursore: impostarlo non serve a niente | si mira muovendo `game.input.mouse.x/y` (vedi §9) |
| **In una prova scriptata** la mira punta altrove dopo un teletrasporto | la camera arriva smorzata, quindi la conversione mondo→schermo di un istante prima non vale più | `game.camera.snapTo(...)` e un decimo di secondo di attesa prima di mirare |
| **In una prova scriptata** un bersaglio appena teletrasportato è immune | `pedGrid`/`vehicleGrid` sono ricostruite a ogni frame: la query lo cerca ancora dov'era | aspettare un frame dopo lo spostamento |
| Ai piani alti le attività erano stanze vuote | i due vani scala occupano tutto il muro di fondo: cucina, frigoriferi e rastrelliere venivano scartati uno per uno | `buildFloor` calcola `f.band` (muro di fondo libero) e `f.body` (sala sotto i pianerottoli), e le piante usano solo quelle |
| `E` sulla soglia di un negozio rubava l'auto parcheggiata dietro | due sistemi leggevano lo stesso fronte di tasto nello stesso frame | `shops.update` gira **prima** di `player.update` e pubblica `shops.near`; il giocatore salta l'entrata in auto se è pieno |
| Il primo articolo del listino veniva comprato da solo | `E` apre il pannello e `E` compra: il fronte del tasto era ancora vivo | `ShopMenu.cooldown = 0.25` all'apertura |
| Una granata lanciata dentro restava appesa a mezz'aria | `projectiles.update` era nel ramo saltato quando si è dentro | gli esplosivi girano sempre; a cambiare è `game.area()` su cui rimbalzano |
| L'interno sembrava una pianta catastale, minuscola in mezzo allo schermo | zoom 1.12 e camera al seguito, come in strada | `roomZoom` (fit del piano) + camera sul centro della stanza |
| «NaN colpi inclusi» sulla mazza in vendita | le armi da mischia non hanno `pickup` | `weaponItem` guarda `spec.infinite` prima di moltiplicare |
| Un velivolo in volo viene sbattuto giù da niente | `vehicleGrid` è piatta: la prima berlina che passa *sotto* lo prende in pieno | `resolveVehicleCollisions`, `if (o === v \|\| airborne(o)) continue` |
| L'aereo parcheggiato non parte, e si rompe | era ormeggiato col muso verso le cisterne invece che verso il raccordo | `airSpots`, `angle: horiz ? -PI/2 : PI`; torre e cisterne spostate fuori dal piazzale |
| La barca ormeggiata non si muove per due secondi | muso verso terra: `resolveMarine` la respinge finché non gira | `boatSpots`, `angle: Math.PI` (al largo) |
| Un filare di alberi in mezzo al mare | le strisce dell'Han River Park nascevano su tutte le campate, anche a ovest della costa | `generateCity`, `if (x < city.quayX) continue` |
| Una barca che risale la costa sbatte contro il nulla | i muretti d'argine del Han partivano da x=0 e continuavano sull'acqua | argini tagliati a `city.quayX`: alla foce l'argine non c'è |
| L'aeroporto si mangia mezza provincia | una delle quattro arterie di bordo era stata spenta dal diradamento della campagna, e la fusione degli isolati non si fermava più | `carveMesh` passo 5: i bordi della piattaforma vengono **riaccesi** prima di svuotarla |
| Atterrare costava un terzo della fusoliera | la discesa comandata arrivava a −286 px/s, ben oltre `HARD_LANDING` | effetto suolo in `updateAircraft`: sotto i 60 px con `climb < 0` la caduta si smorza |
| **In una prova scriptata** il velivolo non si muove | `updateDriving` riscrive `throttle`/`steer`/`climb` dall'input a ogni frame | i comandi si danno con `game.input.down.add('KeyW')` |
| **In una prova scriptata** il giocatore muore appena teletrasportato | è finito in acqua, e a piedi in acqua si annega | teletrasportarlo sul molo, poi `enterVehicle` |
| Metà del traffico si tampona a gas costante, dicendosi `libero` | la distanza di sicurezza era misurata **fra i centri**: per una berlina lunga 78 px la frenata cominciava a paraurti già in contatto | `traffic.senseAhead`, `gap = forward − (len + olen) / 2` |
| Una coda si ferma da sola senza niente davanti (onde di stop-and-go) | la velocità *desiderata* veniva moltiplicata per quanto spazio mancava: chi frena troppo fa frenare di più chi ha dietro, e l'onda risale la fila | `senseAhead` restituisce un **tetto** di velocità (`lead + (gap − want) × 2.6`), non un fattore |
| Due mezzi fermi **dentro** l'incrocio, ognuno davanti all'altro | la prenotazione del nodo veniva liberata al cambio d'arco: lì il muso è sulla strada nuova ma la coda è ancora in mezzo, e l'asse perpendicolare parte addosso | `ai.clearing`, la prenotazione si libera a distanza dal nodo |
| Auto ferme al **verde** | prenotazione d'asse *e* semaforo sullo stesso incrocio: due arbitri, e quello dell'asse rosso non aveva ancora liberato | la prenotazione vale solo dove `!endNode.signal` |
| Nessuno entra più in nessun incrocio | "non entrare se non esci" senza filtro di corsia contava anche il traffico fermo in senso opposto, a 38 px di lato | `boxBlocked` proietta sulla direzione d'uscita e scarta chi è oltre 34 px di lato |
| Ognuno cede il passo a chi gli sta cedendo il passo | su maglia fitta l'uscita di un incrocio è già la coda di quello dopo: la cortesia si propaga all'indietro e non si scioglie mai | `ai.boxT`: dopo 3,5 s si entra lo stesso |
| Una coda ferma indietreggia e si tampona da sola | `throttle` negativo a velocità nulla **è retromarcia**, non freno | `if (v.speed > 3) throttle = −1; else { throttle = 0; handbrake = true }` |
| La manovra di sblocco sbatte le auto contro i palazzi | si indietreggiava senza guardare cosa c'è dietro | `startRecovery` controlla veicoli **e** `solidGrid` dietro; se è chiuso forza il passaggio invece di indietreggiare |
| Auto che nascono dentro un autobus | lo spazio libero preteso allo spawn era 88 px fissi, e un autobus è lungo 158 | `spawnTrafficNear`, `54 + len/2 + GAP_STOP` |
| Le code crescono finché non si smaltiscono più | con una distanza di sicurezza vera, 54 auto nell'anello di streaming superano la capacità degli incroci semaforizzati | `MAX_TRAFFIC` 54 → 44 (misurato: a 48 il flusso cala del 23%, a 44 del 6%) |
| Il temporale arriva a ritroso e finisce con uno scatto | `lerp(next, weather, blend)` invece di `lerp(weather, next, blend)`: a `blend = 0` restituisce già la condizione nuova, poi per 25 s torna verso la vecchia | `daycycle.apply`, `blend` va **da `weather` a `next`** |
| Un tramonto col temporale è viola invece che plumbeo | la nuvolosità alzava solo la forza della tinta, non ne cambiava il colore: restava quella dell'ora | `daycycle.apply`, `amb` tirata verso `SLATE` in funzione di `cloudiness` |
| `TypeError: … reading 'dayCycle'` a ogni pedone dentro un negozio | `interiorscene` chiama `scene.drawPed` con tre argomenti, e `drawPed` ne ha preso un quarto (`game`) per la pioggia | firma cambiata in un posto solo su due: `scene.drawPed` è **condiviso** fra strada e interni, come `drawPlayer` |
| La gente al tavolo di un 분식 apre l'ombrello | `drawPed` è lo stesso codice dentro e fuori, e leggeva `rain` senza guardare dove si trova | guardia `game.indoors` in `drawPed` |
| L'orologio dell'HUD è un emoji che cambia da macchina a macchina | `weather.icon` usato come glifo | icone del meteo disegnate con path (`hud.drawWeatherIcon`), come tutto il resto della grafica |
| L'asfalto resta bagnato per minuti dopo aver forzato `clear` in una prova | `setWeather` saltava alla nuova condizione ma lasciava `wet` a asciugarsi da solo (0.0016/frame) | `setWeather` porta `wet` a 0 o 1 insieme al resto |
| Assediando la porta la polizia sparisce dopo un secondo | `prune` misura la distanza da `player.x/y`, che dentro un edificio è la pianta: tutto risulta oltre 2200 px | `police.focus`, da cui passano `prune`, gli spawn e l'elicottero |
| Un agente di rinforzo compare fra gli scaffali del 편의점 | `addCop` faceva `game.peds.push`, e dentro `game.peds` è la gente del piano | `police.addCop`: `game.indoors ? game.pedSystem.peds : game.peds` |
| Svuotata una cassa al terzo piano, le pattuglie corrono nell'angolo nord-ovest della mappa | `wanted.add` registrava le coordinate della pianta come ultima posizione nota | `wanted.add`: se si è dentro si registra `shops.active.shop` |
| Le volanti escono dall'assedio a razzo e sbandano | durante l'assedio si scrive `x/y` a mano, ma `speed`/`vx`/`vy` restano quelli di prima e `traffic.update` li riprende alla lettera | `police.siegeCar` azzera velocità e comandi, `endSiege` chiama `snapToRoad` |
| Un pedone su due viene saltato nel frame in cui un agente risale in macchina | `boardCop` è chiamata da dentro il `for…of this.peds` di `pedSystem.update` | `police._boarded`: la rimozione si rimanda al `prune` del frame dopo |
| Il ricercato si raffredda con la motovedetta a cinquanta metri di poppa | `computeSpotted` guardava solo `cops` e `cars` | `police.computeSpotted`, terzo giro su `this.boats` |
| La SWAT non tira quasi mai la granata | la distanza di ingaggio (120-240 px) sta quasi tutta sotto la soglia minima del lancio (200) | `police.copBehavior`, banda 190-320 px per la SWAT |
| A cinque stelle arriva una granata ogni 2,5 s | «una sola in volo» non è un tetto di cadenza: con sei uomini della SWAT la miccia da 2,2 s diventa il periodo | `police.NADE_GAP`, 5 s di pausa per la squadra dopo ogni scoppio |
| Una motovedetta si pianta contro un molo e non riparte | in acqua non passa nessuno a spostarla, e non c'è grafo da cui riagganciarsi | `police.driveBoat`, anti-incastro in retromarcia come per le volanti |
| La pioggia non lava niente per quanto si aspetti | `Fx` non vede il meteo: `main` chiamava `fx.update(dt)` e basta | `fx.update(dt, game)`; `drawDecals` invece resta a un argomento, la usa anche `interiorscene` |
| Un incendio grosso fa sparire traccianti e sangue a metà volo | 22 pozze × 26 particelle/s riempiono da sole 346 dei 420 posti di `fx` | strozzatura `26 × min(1, 10 / fires.length)` in `updateFires` |
| Il fuoco si accatasta dov'è invece di camminare | senza distanza minima le figlie nascono dentro la madre | `projectiles.canBurn`, distanza minima `0.72 × r` |
| I pedoni al riparo costano più della pioggia stessa | venti fermi contro un muro rifacevano la query dei solidi a ogni frame | `updatePed`, il push anti-muro vale per `shelter` solo con `targetSpeed > 0` |
| Un posto auto resta occupato per sempre da un'auto venduta o affondata | togliere un veicolo da `game.vehicles` non libera il suo stallo | `shops.sellVehicle` e `main.onVehicleSunk`: `if (v.spot) v.spot.taken = false` |
| Il commesso scappato è di nuovo dietro al banco alla visita dopo | `f.people` non è più lo stesso array di `f.staff`: lo splice toglieva solo dalla copia | `shops.updateInside`, `drop(f.staff, p)` e `drop(f.crowd, p)` |
| Un buco nel muro di fondo che non porta da nessuna parte | il varco veniva aperto prima di sapere se dietro l'edificio c'è posto per un piede | `buildInterior(shop, back)`, `back` deciso da `shops.backDoorSpot` una volta sola |
| Il meteo dopo otto ore di sonno è quello di otto ore prima | `hour = x` sposta l'orologio ma non fa girare la catena di Markov | `daycycle.advance`, passi di 5 s con `apply()` dentro il ciclo |
| Una stella arriva dal nulla dopo essere rinato in ospedale | l'allarme silenzioso continuava a scorrere durante la morte, e la morte azzera il ricercato | `shops.updateAlarm`, uscita su `game.player.dying` |
| Il 거래책 sparisce proprio quando ti serve | un'auto che accosta fa scappare chi ha intorno, e una guardia spaventata restava `walk` per sempre | `updatePed` rimette in `guard` chi ha `turf`; `canDeal` guarda il recinto, non lo stato |
| Due uomini marchiati come contatto nello stesso cortile | il flag lo scrivevano sia `spawnTurf` sia il rimpiazzo, e il giocatore parlava con quello sbagliato | solo `refreshDealer` lo assegna, e spegne il precedente |
| Una raccolta a terra dentro un muro | nessuno controllava il punto: la molotov garantita davanti alla safehouse era murata da tre fasi | `pickups.freeSpot` e `addNear` |
| **In una prova scriptata** un incendio ammazza il giocatore fermo | il fuoco propagato cammina di ~60 px per generazione e torna addosso a chi l'ha appiccato | `pl.hp = 1e6` per lo scatto, o appiccare a più di 300 px |
| **In una prova scriptata** «tengo premuto il mouse» non spara | `mouse.down = true` a mano non alza `mouse.pressed`, e le semiautomatiche guardano il fronte | si prova con un'arma `auto` (SMG, minigun) |
| **In una prova scriptata** il contatto di una banda non c'è | le guardie nascono a scaglioni e a più di 300 px dal giocatore: due secondi non bastano | avvicinarsi da **fuori** dal recinto e aspettarne sette |
| **In una prova scriptata** `player.attack(game)` esplode | la firma è `attack(game, spec)`: senza spec si legge `.melee` di `undefined` | `attack(game, WEAPONS[id])` |
| L'ambiente copre gli spari | il rumore rosa è ~3× più forte del bianco a parità di guadagno, e i letti erano tarati a occhio: misurato, l'ambiente aveva **lo stesso rms di un colpo di pistola** | buffer rosa normalizzato in `audio.makeNoise`, guadagni dei letti scesi di 3×, e `audio-census.scene` per non rifarlo a occhio |
| Una porta che si chiude non si sente | il suono nasceva **prima** di `camera.snapTo`, con l'ascoltatore ancora dentro la stanza: risultava a 2000 px e veniva scartato | `shops.stepOutside`, chiamata in coda alla funzione |
| Spegnendo la radio si riaccendeva sulla stazione dopo | staccare la sorgente da un `<audio>` (`removeAttribute('src')` + `load()`) fa scattare un `error`, e il gestore lo leggeva come «stazione muta, passo alla prossima» | `radio.fail`, uscita immediata se la radio è spenta |
| La radio suona in un `MediaElementAudioSourceNode`… muta | una sorgente di un'altra origine senza CORS **tainta** il nodo: il grafo gira, l'audio no. È la norma per gli Icecast delle emittenti | la radio **non** passa da WebAudio: `<audio>` e `el.volume` (§5.14) |
| Una stazione «rotta» che nell'app dell'emittente funziona | è HLS (`.m3u8`) o una playlist (`.pls`): `<audio>` non le sa leggere, e senza librerie non c'è modo | `radio.usable`, filtro sull'estensione e sul codec |
| **In una prova scriptata** l'audio non suona mai | senza gesto dell'utente il contesto resta sospeso, e sospeso vuol dire orologio fermo | `probe.mjs` passa `--autoplay-policy=no-user-gesture-required`; la scena chiama `game.audio.unlock()` |
| **In una prova scriptata** il ricercato torna a 0 da solo | il giocatore fermo allo spawn viene investito, oppure a cinque stelle la SWAT lo ammazza in ~8 s: la morte azzera tutto | metterlo su un marciapiede (`city.hospitals[i]`) e campionare entro 7 s |
| Il giocatore attraversa le auto e ci cammina sopra | `player.resolveCollisions` interrogava solo `area.grid` (edifici, props, limiti): i veicoli non ci sono mai stati, e in una visuale dall'alto il tetto è disegnato più in alto del marciapiede | `player.resolveVehicleCollisions`, sui tre cerchi di `collisionCircles` — **prima** dei muri, o un'auto ti spinge dentro una vetrina |
| Espulso da un'auto con spinta di lunghezza zero | il giocatore esattamente sull'asse del veicolo: la normale è `(0,0)` e la spinta non esiste | `resolveVehicleCollisions`, ripiego sulla perpendicolare al muso (da sotto un'auto si esce di fianco) |
| **In una prova scriptata** il giocatore non risponde a niente | il menu iniziale è ancora a schermo: `player.update` non viene chiamato finché `game.started` è falso (§5.18) | `probe.mjs` apre la pagina con `?autostart=1`; a mano si chiama `game.start(false)` |
| **In una prova scriptata** la musica della caccia si spegne da sola a metà misura | a cinque stelle la SWAT stende il giocatore, `player.dying` diventa vero e la regia toglie il pezzo | `pl.hp = 1e6` mentre si misura, come già serviva per il ricercato |
| Uno stacco musicale non si sente proprio dove serviva | il bus del pezzo è a zero (è lì che la musica tace): quello che ci passa dentro esce a volume zero | `music.stings`, un bus che non sfuma mai, separato da `music.bus` |
| La mira sbaglia sempre di più allontanandosi dal centro | `apply` schiacciava il piano di terra e `screenToWorld` no: sono tre trasformazioni scritte in tre posti (`apply`, `worldToScreen`, `screenToWorld`) e vanno cambiate tutte e tre | `camera.js`, e `tilt-check.scene` le confronta fra loro (§9) |
| Le auto compaiono in campo visivo dopo aver piegato la camera | `bounds()` restituiva il rettangolo di prima, ma lo schermo schiacciato ne inquadra il 9% in più in verticale: l'anello di streaming cadeva dentro l'inquadratura | `camera.bounds`, `viewH / (2 · zoom · TILT_COS)` |
| Entrando in un negozio il muro di fondo copre tutta la pianta | il nadir della vista piegata sta 393 px a sud, cioè più in là del muro di una stanza profonda 300 | `InteriorScene.render`, `cam.lean = 0` — lo schiacciamento resta, l'apertura no |
| Il protagonista sparisce dietro al palazzo che ha appena superato | è l'inclinazione, e l'ordine di disegno è corretto: quel volume è più vicino all'occhio | `scene.drawPlayerThrough`, sagoma in trasparenza; l'ordine non si tocca |
| I palazzi compaiono a scatti sul bordo basso dello schermo | con la camera piegata un volume si apre verso l'alto anche al centro: chi ha la pianta appena sotto il bordo ha il tetto dentro | `scene.BUILD_PAD`, margine in più **solo verso sud** (allargarlo tutt'intorno costa il 28% di edifici disegnati) |

Regola generale emersa: **prima di dare la colpa all'AI, verifica la geometria.** Quasi tutti
gli "stalli dell'AI" erano problemi di ingombri, corsie o posizionamento.

---

## 4bis. Chiuso: il traffico si muoveva male

**Segnalazione dell'utente:** *«il traffico si muove spesso in modo strano e fanno molti
incidenti o ingorghi»*. **Risolto in §5.10**, dove ci sono la diagnosi completa e le misure.
Questa sezione resta come esempio di metodo, perché è il modo in cui va affrontato il
prossimo problema di questo tipo.

**Il difetto non era nell'AI: era nella geometria** (che è la regola generale del §4). La
distanza di sicurezza si misurava **fra i centri** dei due veicoli invece che fra le
carrozzerie: per una berlina lunga 78 px la frenata cominciava quando i paraurti si stavano
già toccando. Metà degli urti erano tamponamenti, e il 78% dei veicoli coinvolti si dichiarava
`libero` un istante prima di tamponare — non stavano frenando perché non vedevano niente.

**Quello che ha funzionato, come metodo:**

1. **Misurare prima di toccare.** Un censimento che classifica ogni urto (tamponamento,
   laterale, frontale, contro un solido), dice quanto è lontano dall'incrocio più vicino e
   cosa diceva di sé il veicolo (`ai.why`) nell'istante dell'urto. È
   `.claude/tools/scenes/traffic-census.scene`, ed è rimasto nel repo.
2. **Guardare l'ingorgo, non il codice.** Tre volte su tre la diagnosi è arrivata portando la
   camera sul grumo di auto ferme più grosso e leggendo lo stato di *ogni* veicolo dentro —
   `stopDist`, `claim` del nodo, `stallT`. Il difetto che ne è uscito (la prenotazione
   dell'incrocio liberata mentre l'auto è ancora in mezzo alla giunzione) nel sorgente non si
   vedeva: sembrava corretta.
3. **Misurare il flusso, non quanti sono fermi.** «Quante auto sono ferme adesso» è una
   fotografia che peggiora *proprio quando il traffico migliora*, perché le auto sane si
   fermano ai semafori. La misura giusta è quanta strada percorre un veicolo al minuto.
4. **Misurare su più zone.** Qualunque modifica alla guida sposta le traiettorie e cambia lo
   scenario: su una scena sola si finisce per tarare su un ingorgo che nasce o non nasce per
   caso. Su cinque zone il rumore si media.

---
