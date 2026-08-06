# Parametri per la messa a punto

> §8 del progetto. Indice generale e mappa dei rimandi: [HANDOFF.md](../HANDOFF.md).

## 8. Parametri da conoscere per la messa a punto

| Cosa | Dove | Valore attuale |
| --- | --- | --- |
| Dimensione mondo | `citygen.WORLD` | 5400 × 5400, margine 150 |
| Sagoma della città | `districts.URBAN_BLOBS` | 8 macchie, raggio 0.13–0.205 della larghezza |
| Soglia città/campagna | `citygen.RURAL_U` | 0.26 (sotto: solo una arteria su due) |
| Strade bianche in campagna | `citygen.carveMesh` | 6% dei tratti non arteriali |
| Mare: limite di maglia / battigia | `districts.SEA.x1`, `citygen.QUAY_W`, `coastAt` | 0.185 · banchina 128 px · battigia fino a 560 px più a ovest |
| Piattaforme (aeroporto, porto) | `citygen.planPlatform` | campate fra arterie: 2 bande in y l'aeroporto, 1 il porto |
| Aeroporto e porto (seed attuale) | `city.airport` / `city.port` | 1039 × 1530 · 1039 × 775 |
| Moli e ormeggi | `citygen`, sezione costa | 4 al porto + 6 sul Han · 14 imbarcazioni |
| Velivoli parcheggiati | `city.airSpots` | 3 turboelica + 3 elicotteri |
| Territori delle bande | `citygen.TURF_ANCHORS` | 6, su cortili e piazzali già esistenti |
| Passo della maglia | `districts.DISTRICTS[].grid.step` | 126–196 (Hongdae) … 330–480 (moli) |
| Superblocchi / disassamenti | `districts.DISTRICTS[].grid` | `superblock` 0.20→0.60, `jog` 0.08→0.62 |
| Isolato minimo ai lati di un dogleg | `citygen.planDoglegs` | `MIN_BLOCK` 62 |
| Ritaglio che diventa parco | `citygen.generateCity` | lato < 64 px (sopra: fila di negozi) |
| Vicolo passante | `citygen.fillUrbanBlock` | isolati > 320 px, fessura 38–54 |
| Quota: pianura / rilievi | `citygen.makeElevation` | 34 + rumore ±31 / Namsan +110, Bukhansan +150 |
| Forza dell'ombreggiatura | `ground.RELIEF_SLOPE` / ampiezza | 0.062 / ±44 (mappa: 0.07 / ±58) |
| Gravità in pendenza | `vehicle.SLOPE_G` / `MAX_SLOPE` | 780 / 0.14 |
| Forza della parallasse | `camera.PROJ` | 880 (più basso = più estrusione) |
| Direzione/lunghezza ombre | `camera.SUN` | 0.5 / 0.66, scala 0.42 |
| Larghezza carreggiate | `citygen.genLines` | boulevard 144, strada 76 |
| Corsie | `roadgraph.laneOffset` | 18/54 (boulevard), 19 (strada) |
| Traffico attivo | `traffic.MAX_TRAFFIC` | 44 (× densità distretto) — vedi §5.10 |
| Auto in sosta | `traffic.MAX_PARKED` | 24 |
| Spazio libero da fermi | `traffic.GAP_STOP` | 13 px fra i paraurti |
| Distanza voluta / reattività | `traffic.senseAhead` | `13 + v × 0.16` px · guadagno 2.6 |
| Spazio preteso oltre l'incrocio | `traffic.boxBlocked` | mezza giunzione + tutta la carrozzeria + 13 |
| Cortesia massima all'incrocio | `traffic.driveAI` `ai.boxT` | 3,5 s, poi si entra lo stesso |
| Prenotazione dell'incrocio | `driveAI` (solo nodi senza semaforo) | scade dopo 0,6 s senza rinnovo |
| Fermo troppo a lungo → manovra | `driveAI` `ai.stallT` | 9 s (il rosso più lungo dura 7,7 s) |
| Ciclo del semaforo | `roadgraph.SIGNAL_CYCLE` / `YELLOW` | 15,5 s (verde 6,75 per asse, giallo 1) — misurato in §5.12: 19 s è peggio, 12 s è indistinguibile |
| Pedoni | `pedestrians.BASE_MAX` | 62 (× densità distretto) |
| Pendenza minima per una scalinata | `citygen.STAIR_GRADE` | 0.018 (→ 8 scalinate su 14 vicoli passanti) |
| Danno / cadenza delle armi | `weapons.WEAPONS` | pugni 15·0.34 · mazza 46·0.52 · katana 92·0.4 · pistola 27·0.22 · pompa 13×8·0.84 · SMG 15·0.075 · fucile 24·0.105 · sniper 145·1.35 · minigun 12·0.045 |
| File della barra armi (tasti 1-6) | `weapons.WEAPON_SLOTS` | mischia · pistola · pompa · SMG+fucile · sniper+minigun · esplosivi |
| Perforazione del sniper | `weapons.WEAPONS.sniper.pierce` | 2 bersagli oltre il primo (solo pedoni) |
| Mirino: ingrandimento e scostamento | `sniper.scope`, `player.SCOPE_LEAD/SCOPE_MAX` | 2.3 (zoom 1.12 → 0.49) · 0.5 con tetto 300 px |
| Malus di mira senza mirino | `player.attack` | dispersione × 9 |
| Minigun: spin-up e mobilità | `minigun.spinUp` / `heavy` | 0.8 s · velocità × 0.56 (niente scatto) |
| Esplosivi: raggio e danno | `weapons.WEAPONS` | granata 155 px · 190 · miccia 2.2 s; mina 140 px · 220; molotov pozza 78 px · 9.5 s · 26 dps |
| Danno d'esplosione in auto | `projectiles.explode` | × 0.45 (a piedi 1.0) |
| Volo di un lancio | `projectiles` `GRAV`/`THROW_Z` | 620 px/s² · 150 (gittata = distanza del cursore, max `spec.range`) |
| Volumi di fabbrica | `audio.DEFAULT_MIX` | master 0.7 · effetti 1 · ambiente 0.8 · **musica 0.7** · interfaccia 0.75 · radio 0.8 |
| Musica: passo e livello | `music.BPM` / `music.LEVEL` | tema 84 bpm a 0.85 · caccia 148 bpm a 0.5 (× 0.72–1 con le stelle) |
| Musica: anticipo e dissolvenza | `music.LOOKAHEAD` / `damp` in `update` | 0,25 s di note programmate · mezza vita 0,3 s (~1,9 s per cambiare pezzo) |
| Autosave: periodo e ritenta | `save.AUTO_EVERY` / `AUTO_RETRY` | 240 s · 20 s se il momento non è buono |
| Autosave: quando si rifiuta | `save.canAutosave` | stelle > 0 · HP ≤ 25 · morente · manette in corso |
| Menu iniziale: giro di camera | `main.updateAttract` | raggio 250 × 170 px, un giro ogni ~40 s, zoom 0.92 |
| Innesco della mina | `projectiles.updateMines` | veicolo 32 px · piedi 18 px, si arma a 62 px da chi l'ha posata |
| Tick di danno del fuoco | `projectiles.FIRE_TICK` | 0.34 s |
| Magnetismo di mira | `weapons.ASSIST_WINDOW` / `ASSIST_BEND` | cono 0.17 rad / correzione max 0.09 rad |
| Peggioramento del drive-by | `player.driveBy` | dispersione × 2.4, cadenza × 1.5 |
| Teppista armato: gittata e cadenza | `pedestrians.GUN_RANGE`, case `hostile` | 330 px, un colpo ogni 0.5-1.3 s |
| Salute e tempo a terra | `player.maxHp` / `DEATH_TIME` | 100 / 2.8 s |
| Soglie delle stelle | `wanted.LEVEL_HEAT` | 10 · 24 · 52 · 92 · 145 |
| Peso dei reati | `wanted.CRIMES` | rissa 1.5 · sparo 3 · furto 6/12 · agente ferito 12 · veicolo 18 · morto 24 · agente ucciso 60 |
| Secondi invisibili per perdere una stella | `wanted.COOL_TIME` | 7 · 11 · 15 · 20 · 26 |
| Scarico dell'heat sotto la prima stella | `wanted.update` | 0.6 al secondo |
| Unità per livello | `police.TIERS` | 3 agenti → 2 volanti → speroni → blocchi+chiodi → SWAT+elicottero |
| Vista delle pattuglie | `police.SEE_FOOT` / `SEE_CAR` | 470 / 640 px (con linea di vista libera) |
| Tetti delle unità | `police.MAX_COPS`, `reinforce` | 10 (+6 dai posti di blocco) agenti, `tier.cars + 3` volanti |
| Gittata di fuoco della polizia | `police.COP_FIRE_RANGE` | 340 px |
| Riflettore e quota dell'elicottero | `police.BEAM_R` / `CHOPPER_Z` / `CHOPPER_HP` | 118 px / 210 / 260 |
| Gomme a terra | `vehicle` `flatTires` | velocità × 0.6, grip × 0.72, tiraggio `flatPull` |
| Ritmo di posa di blocchi e chiodi | `police.manageObstacles` | uno ogni 7 s, alternati |
| Raccolte a terra | `pickups` densità / `RESPAWN` | 0.4 per cortile (43 totali) / 55 s |
| Densità delle vetrine | `citygen.placeShops` | `signDensity × 0.55` (139 negozi, 369 locali), una porta ogni 80 px |
| Attività per edificio | `citygen.makeShop` | `1 + (h3d − 30) / 46`, massimo 4 |
| Taglia di un interno | `interiors.buildInterior` | footprint × 1.8, limitato a 300-470 × 260-390 |
| Muri e vani scala | `interiors` `WALL` / `STAIR_W×H` / `DOOR_W` | 12 · 58×78 · 54 |
| Raggio della porta e del bancone | `shops` `DOOR_REACH` / `DESK_REACH` | 34 px / 54 px |
| Denaro iniziale · cassa · conto della clinica | `player.money` · `interiors` · `main.respawnPlayer` | ₩60.000 · ₩20.000-90.000 · 25% dei contanti |
| Officina e cambio d'abito | `shops` `GARAGE_PRICE` / `OUTFIT_PRICE` | ₩30.000 · ₩40.000 (−1 stella) |
| Prezzi delle armi | `weapons.WEAPONS` `price`/`ammoPrice` | pistola 65k · pompa 145k · SMG 240k · fucile 380k · sniper 620k · minigun 1.25M |
| Ricompra del banco dei pegni | `shops.stockFor` case `pawn` | 45% del prezzo |
| Peso della rapina | `wanted.CRIMES.rob` | 22 (una stella) |
| Zoom dentro un interno | `shops.roomZoom` | fit del piano, limitato a 1.15-2.6 |
| Durata di un giorno · ora d'inizio | `daycycle.DAY_SECONDS` · `DayCycle` | 24 minuti reali (1 min di orologio al secondo) · si parte alle 8:24 |
| Colore e forza della luce, ora per ora | `daycycle.KEYS` | 11 chiavi: `amb`+`k` (tinta), `warm`+`w` (velo caldo), `sx`/`sy` (ombra), `sh` (opacità) |
| Accensione delle luci artificiali | `daycycle.lampsAt` | 0 fino alle 17, 1 dalle 19:30 alle 5; `isNight` = `lamps > 0.5` |
| Tinta del cielo coperto | `daycycle.SLATE` · `apply` | `#8e96a4`, pesata `cloudiness × 0.62` |
| Durata delle condizioni di tempo | `daycycle.WEATHERS[].hours` | sereno 7-22 h · nuvoloso 5-16 · pioggia 4-12 · temporale 2-6 (ore di gioco) |
| Transizione fra due condizioni | `daycycle.updateWeather` | 25 s |
| Asciugatura dell'asfalto | `daycycle.update` (`wet`) | misurato: bagnato in 4,4 s, asciutto in 30 s |
| Passo di rotazione del sole | `scene.SUN_STEP` / `SHADOW_K` | 0.055 (una tacca ogni 30-50 s reali) / 0.84 |
| Gocce disegnate col temporale | `scene.RAIN_DROPS` | 340 tratti in un path solo |
| Aderenza e frenata sul bagnato | `vehicle.updateVehicle` | grip × (1 − wet·0.17), freno × (1 − wet·0.14) |
| Vista della polizia col buio e la pioggia | `police.visionScale` | × (1 − lamps·0.26) × (1 − rain·0.20) |
| Popolamento per fascia oraria | `daycycle.trafficScale` / `pedScale` | punta serale ×1.15 · notte fonda ×0.34 e ×0.2 · pioggia −18% e −55% |
| Pedoni con l'ombrello | `pedestrians.createPed` | 62%, tinta fra 6 (`UMBRELLAS`) |
| Orari dei locali | `interiors.BUSINESSES[].open` | `[apre, chiude]`, `[0,24]` = sempre; 편의점 · 병원 · 주택 non chiudono mai |
| Tile terreno | `ground.TILE` / `MAX_TILES` | 512 px / 96 |
| Volo: salita, tetto, velocità di rotazione | `sprites.VEHICLE_TYPES` `climb`/`ceiling`/`rotate` | elicottero 130 · 400 · da fermo; turboelica 105 · 460 · 250 px/s |
| Atterraggio duro / effetto suolo | `vehicle.HARD_LANDING`, `updateAircraft` | oltre 150 px/s di caduta si rompe; con discesa comandata sotto i 60 px si smorza a 140 |
| Caduta in stallo | `vehicle.GRAV_AIR` | 210 px/s² (ala sotto `rotate × 0.8`) |
| Imbarcazioni: grip e velocità | `VEHICLE_TYPES.boat` / `.ferry` | 0.34 · 400 px/s ; 0.26 · 215 px/s |
| Spinta a riva di una barca | `vehicle.resolveMarine` | 190 px/s verso l'acqua, campionata a 46 px su 8 direzioni |
| Affondamento di un mezzo di terra | `vehicle.sink` | 0.75 s in acqua, poi `onVehicleSunk` |
| Guardie per territorio · raggio di spawn | `pedestrians.spawnTurf` | max 4 · almeno 300 px dal giocatore |
| Provocazione di una banda | `pedestrians.watchTurfs` | arma diversa dai pugni **oppure** ricercato ≥ 1 stella |
| **— arretrati (§5.12) —** | | |
| Commissariati | `citygen`, sezione «Commissariati» | uno per distretto urbano (4 con la seed attuale), a più di 420 px dall'ospedale |
| Raggio del commissariato per lo spawn | `police.STATION_REACH` | 1600 px (oltre, si ricade sull'anello) |
| Assedio: agenti attorno alla porta / volanti / rinforzi | `police.siegeCop` · `siegeCar` · `siege` | 60-220 px · in corsia, 52 px oltre la porta e una ogni 78 · uno ogni 1,4 s |
| Richiamo dell'equipaggio | `police.RECALL_FAR` / `RECALL_LOST` / `RECALL_R` / `RECALL_GIVEUP` / `BOARD_R` | 750 px · 5 s · 260 px · 12 s · 30 px |
| Motovedette | `police.MAX_BOATS` / `MARINE_LEVEL` · `sprites.VEHICLE_TYPES.patrol` | max 2 · da 3 stelle, solo in acqua o in barca · 104×34, 355 px/s, grip 0,33, 190 HP |
| Elicottero anticipato | `police.updateChopper` (`offT`) | 3 stelle se in volo o in barca (memoria 6 s), 5 negli altri casi |
| Granata della SWAT | `police.NADE_MIN` / `NADE_MAX` / `NADE_CD` / `NADE_GAP` | 200-430 px · 9 s per agente · 5 s per la squadra · max 1 in volo |
| Distanza di ingaggio a piedi | `police.copBehavior` | SWAT 190-320 px, divisa 120-240 px |
| Chiodi sul traffico civile | `police.SPIKE_WATCH` / `SPIKE_SLICE` | 700 px · 6 veicoli per frame a rotazione, 3 punti per carrozzeria |
| Peso di un lancio esplosivo | `wanted.CRIMES.blast` | 6 (due granate = una stella) |
| Riparo dei pedoni | `pedestrians.RAIN_SHELTER` / `SHELTER_REACH` / `SHELTER_MAX` / `RAIN_HURRY` | 0.35 · 340 px · 40 s · ×(1 + rain × 0.12) |
| Chi si ripara | `pedestrians.createPed` `shy` | 75% di chi non ha l'ombrello (≈28% del totale) |
| Pioggia che spegne le pozze / lava il sangue | `projectiles.RAIN_DOUSE` · `fx.WASH_RATE` | `1 + rain² × 3.6` (9,7 / 4,6 / 2,1 s) · 0.05 di opacità al secondo × rain |
| Propagazione del fuoco | `projectiles.MAX_FIRES` / `SPREAD_EVERY` / `SPREAD_LIFE` / `SPREAD_R` / `RAIN_STOP` | 22 pozze · 0,9 s · vita × 0.62 · raggio × 0.86 · rain 0.35 |
| Auto che incendia l'asfalto | `projectiles.updateFires` | sotto il 45% della lamiera, 50% per tick |
| Minigun: calore | `player.HEAT_TIME` / `HEAT_COOL` / `HEAT_OK` / `HEAT_GRACE` | 4,5 s di raffica (100 colpi) · 0.16/s · riparte a 0.35 · 0,35 s di respiro |
| Scivolata a piedi sul bagnato | `player.WET_SLIDE` | 0.6 (dimezzamento 0.055 → 0.088 s) |
| Mercato per distretto | `shops.MARKETS` · `MARKET_BASE` | 7 distretti × armi/munizioni/generi/auto + ricompra · ×1 e 45% il riferimento |
| Arrotondamento dei prezzi | `shops.roundPrice` | 100₩ sotto i 20k, 500₩ sopra |
| Valore di un mezzo · consegna | `shops.CAR_VALUE` · `vehiclePrice` · `SELL_REACH` | scooter 18k … sportiva 210k … turboelica 900k · `0.35 + 0.65 × hp/maxHp`, gomme ×0.88 · 108 px, fermo sotto 24 px/s |
| Sconto delle bande | `shops.GANG_GUNS` / `SMUGGLE` / `CHOP` / `FENCE_BONUS` / `FENCE_CAP` | 0.88 · 1.18 · 1.42 · +0.14 · tetto 0.56 (tiene la catena in perdita) |
| Raggio del banco di una banda | `shops.DEAL_REACH` | 54 px a piedi, 108 al volante (철마파) |
| Rimpiazzo del 거래책 | `pedestrians.DEALER_WAIT` · `canDeal` | 18 s se lo hai steso, subito se l'ha portato via lo streaming · recinto + 80 px |
| Allarme silenzioso | `shops.ALARM_DELAY` · `updateAlarm` | 17 s · `rob × 0.55` ≈ 12 di heat (22 + 12 = seconda stella) |
| Gente di passaggio, ora per ora | `interiors.RUSH` · `crowd()` | frazione di `biz.crowd` per fasce, 13 tipi di locale · `crowd + 2` posti |
| Varco sul retro | `interiors.BACK_W` · `shops.backDoorSpot` / `SIDE_SCAN` | 44 px all'estremo del muro di fondo · fuori 18-60 px, di lato fino a ±124 (42 negozi su 113) |
| Sonno | `shops.sleepTarget` · `sleep` · `daycycle.advance` | 06:30 o 20:00 · vietato da 3 stelle · passi di 5 s reali |
| Luce dalla porta di un interno | `interiorscene.drawDoorLight` | profondità `34 + 78 × (1 − lamps)` px |
| Raccolte in campagna e sui moli | `pickups.RURAL_TABLE` / `PIER_TABLE` / `placeRural` | 32% dei campi · 85% dei moli del porto, 30% degli scali sul Han (43 raccolte in tutto) |
| Limite pixel canvas | `main.MAX_PIXELS` | 2.9 M (scala il DPR) |
| **— audio (§5.13) —** | | |
| Portata dell'ascolto · panorama stereo | `audio.HEAR` / `PAN_W` | 1500 px (oltre non si costruisce) · 760 px di scarto = tutto da un lato |
| Tetto delle voci brevi | `audio.MAX_VOICES` | 24 (mai superate 20 in un minuto di esplosioni) |
| Volumi di fabbrica | `audio.DEFAULT_MIX` · `localStorage` `seoul.audio` | master 0.7 · effetti 1 · ambiente 0.8 · interfaccia 0.75 |
| Timbro delle armi | `audio.GUN_TONE` · `gunTone(spec)` | 6 righe a mano; le altre armi lo ricavano da danno e cadenza |
| Fondo urbano · pioggia · vento · mare | `audio.updateBeds` | `0.014 + urbanAt × 0.042` · `rain × 0.085` (0.028 dentro) · `0.008 + wind × 0.038` · 0.05 sulla battigia |
| Motore | `audio.updateVehicles` | base `64/√massa`, 3,4 marce finte, `0.028 + rpm × 0.036` |
| Sirena · rotore | `audio.updatePolice` | `0.022 + 0.04 × vicinanza`, ×1.6 max col numero · 0.06 (polizia) / 0.09 (il tuo) |
| Attenuazione in pausa | `audio.updateBeds` (`duck`) | 22% sui letti, interfaccia a volume pieno |
| Passo del giocatore | `audio.updateWalk` | uno ogni 34 px percorsi, sopra 18 px/s |
| **— radio (§5.14) —** | | |
| Directory delle stazioni | `radio.DIRECTORY` · `QUERY` | 3 mirror di radio-browser.info, `countrycode=KR`, per voti, timeout 6 s |
| Stazioni tenute | `radio.MAX_STATIONS` | 14 (su 80 chieste, dopo il filtro su codec e playlist) |
| Attesa prima di agganciare | `radio.TUNE_SETTLE` | 0,45 s (scorrere la manopola non apre cinque connessioni) |
| Stazione muta | `radio.STALL_LIMIT` | 11 s senza dati suonabili → marchiata `broken` e saltata |
| Volume | `audio.mix.radio` · `radio.contextGain` | 0.8 di fabbrica · pieno in auto, ×0.26 nel negozio, ×0.4 in pausa |
| Locali con la radio | `interiors.BUSINESSES[].radio` | 편의점 · 약국 · 옷가게 · 분식 · 술집 · 당구장 |
| Stazioni proprie | `localStorage` `seoul.radio.stations` | `[{name, url}]`, hanno la precedenza sull'elenco scaricato |
| **— salvataggio, arresto, lamiera (§5.15-5.17) —** | | |
| Slot di salvataggio · chiave | `save.SLOTS` · `localStorage` `seoul.save.N` | 3 · versione 1, seed 20260730 (una seed diversa viene rifiutata) |
| Peso di uno slot · costo di un caricamento | misurato | 0,7 kB · 2,7 ms (fps invariati) |
| Ripopolamento dopo un caricamento | `save.apply` | `prewarm(40, 18)` veicoli e 40 pedoni |
| Fermo: raggio, tempo, decadenza | `police.BUST_R` / `BUST_TIME` | 46 px · 1,4 s · si perde al doppio della velocità |
| Chi arresta e quando | `police.ARREST_LEVEL` / `BUST_HP` · `updateArrest` | fino a 3 stelle, solo `kind: 'cop'`, con arma da mischia in pugno **oppure** HP ≤ 25 |
| Costo della cella | `main.bustPlayer` | 20% dei contanti (cauzione) · 6 ore di orologio · arsenale confiscato |
| Investimento a piedi: soglia, danno, cadenza | `player.RUNOVER_SPEED` / `RUNOVER_DMG` / `RUNOVER_GAP` | 70 px/s (21 km/h) · `(v − 70) × 0.3` · un urto ogni 0,5 s |

---
