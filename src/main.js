// Seoul Crashers — bootstrap e game loop.
import { Loop } from './core/loop.js';
import { Input } from './core/input.js';
import { Rng } from './core/rng.js';
import { Events } from './core/events.js';
import { resolveMode } from './core/modes.js';
import { AudioSystem } from './core/audio.js';
import { Radio } from './core/radio.js';
import { KkachiSystem } from './core/kkachi.js';
import { TailSystem } from './core/tail.js';
import { CarrySystem } from './core/carry.js';
import { DynamicGrid } from './core/spatial.js';
import { KMH, clamp, dist } from './core/math.js';
import { createRegion, REGION_IDS } from './world/regions.js';
import { buildMapTexture } from './world/maptexture.js';
import { RouteGuide } from './world/route.js';
import { DayCycle } from './world/daycycle.js';
import { Camera } from './render/camera.js';
import { Scene } from './render/scene.js';
import { Fx } from './render/fx.js';
import { preloadSprites, VEHICLE_TYPES } from './render/sprites.js';
import { Player } from './entities/player.js';
import { TrafficSystem } from './entities/traffic.js';
import { PedestrianSystem } from './entities/pedestrians.js';
import { LifeSystem } from './entities/life.js';
import { ActorSystem } from './entities/actors.js';
import { PickupSystem } from './entities/pickups.js';
import { ProjectileSystem } from './entities/projectiles.js';
import { WantedSystem } from './entities/wanted.js';
import { PoliceSystem } from './entities/police.js';
import { ShopSystem, won } from './entities/shops.js';
import { TurfSystem } from './entities/turfs.js';
import { autosave, tickAutosave } from './core/save.js';
import { InteriorScene } from './render/interiorscene.js';
import { MetroScene } from './render/metroscene.js';
import { Hud } from './ui/hud.js';
import { MapView } from './ui/mapview.js';
import { PauseMenu } from './ui/menu.js';
import { StartMenu } from './ui/startmenu.js';
import { ShopMenu } from './ui/shopmenu.js';
import { MetroSystem } from './ui/metro.js';
import { Cutscene } from './ui/cutscene.js';
import { MobileControls } from './ui/mobilecontrols.js';
import { Dialogue } from './ui/dialogue.js';
import { drawRadioCall } from './ui/radiocall.js';
import { MissionSystem } from './core/missions.js';
import { INTRO, handoff } from './story/intro.js';
import { registerCampaign, beginCampaign } from './story/campaign.js';

const MAX_PIXELS = 2_900_000;
// Dentro un edificio non c'è traffico: la griglia dei veicoli si ricostruisce vuota
// invece di aggiungere un ramo a ogni query.
const NO_VEHICLES = [];

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.camera = new Camera();
    this.input = new Input(canvas);
    // I controlli touch sono un adattatore DOM: quando non c'è un puntatore
    // coarse restano invisibili e non cambiano il percorso desktop.
    this.mobileControls = new MobileControls(this);
    this.rng = new Rng(20260730);
    // Il bus: da qui passano i fatti del mondo, e ci si iscrivono le missioni e la
    // tabella di Kkachi invece di frugare nello stato del gioco a ogni frame.
    this.events = new Events();
    // Il lettore di pannelli. Vuoto finché qualcuno non gli passa una sequenza:
    // la prima è l'apertura, le missioni usano lo stesso oggetto.
    this.cutscene = new Cutscene();
    // Il riquadro delle battute: quello che i pannelli non devono fare, cioè le
    // due righe che si dicono **nel posto in cui succedono** (§5.29).
    this.dialogue = new Dialogue();
    this.time = 0;
    this.debug = false;
    // Falso finché il menu iniziale è a schermo: il mondo gira lo stesso, il
    // giocatore no (§5.18).
    this.started = false;
    this.attractT = 0;
    // Il meteo ha un rng suo: pescare da `this.rng` sposterebbe tutto quello che
    // ci pesca dopo (spawn del traffico, dei pedoni) a ogni cambio di tempo.
    this.dayCycle = new DayCycle(new Rng(20260731));
    this.trafficScale = 1;
    this.pedScale = 1;
    this._wasNight = this.dayCycle.isNight;
    this.vehicles = [];
    this.peds = [];
    this.markers = [];
    this.fx = new Fx();
    this.audio = new AudioSystem();
    // La radio è l'unica cosa del gioco che parla con la rete, e non lo fa
    // finché il giocatore non la accende (§5.14).
    this.radio = new Radio(this.audio);
    // 까치, sulla `91.45`. È una stazione della manopola qui sopra e un lettore
    // di battute a predicato: quello che dice non lo sa (`story/kkachi.js`).
    this.kkachi = new KkachiSystem();
    this.stats = {
      distance: 0,
      topSpeed: 0,
      stolen: 0,
      crashes: 0,
      pedsHit: 0,
      kills: 0,
      deaths: 0,
      busted: 0,
      copsKilled: 0,
      maxWanted: 0,
      choppers: 0,
      blasts: 0,
      robberies: 0,
      visits: 0,
      districts: new Set(),
    };
    this._skidT = 0;
    this.hidden = !!document.hidden;
    this._resizeQueued = false;
    this._queueResize = () => {
      if (this._resizeQueued) return;
      this._resizeQueued = true;
      const apply = () => {
        this._resizeQueued = false;
        this.resize();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(apply);
      else apply();
    };
    window.addEventListener('resize', this._queueResize);
    window.addEventListener('orientationchange', this._queueResize);
    window.visualViewport?.addEventListener('resize', this._queueResize);
    window.visualViewport?.addEventListener('scroll', this._queueResize);
    this.armAudio();
  }

  /**
   * L'audio non può partire prima che l'utente tocchi qualcosa: è una regola dei
   * browser, non una scelta. Il contesto si crea al primo tasto o al primo click e
   * fino a lì `AudioSystem` non fa niente. La scheda nascosta va sospesa a mano:
   * il loop si ferma con `requestAnimationFrame`, i letti continui no.
   */
  armAudio() {
    const start = () => {
      this.audio.unlock();
    };
    // In cattura raggiunge anche i pulsanti touch, che fermano la propagazione
    // per non trasformarsi in un clic sulla tavola sottostante. Resta installato:
    // dopo un ritorno dal background iOS può richiedere un altro gesto per il resume.
    window.addEventListener('pointerdown', start, { capture: true });
    window.addEventListener('keydown', start);
    document.addEventListener('visibilitychange', () => {
      this.hidden = !!document.hidden;
      this.input.clearAll();
      this.mobileControls?.clear();
      this.audio.setActive(!document.hidden);
    });
  }

  resize() {
    // visualViewport è affidabile dopo la rotazione o il cambio della barra del
    // browser mobile. Può riportare zero per un istante: resta il fallback di window.
    const viewport = window.visualViewport;
    const w = Math.max(1, Math.round(viewport?.width || window.innerWidth || 1));
    const h = Math.max(1, Math.round(viewport?.height || window.innerHeight || 1));
    let s = Math.min(window.devicePixelRatio || 1, 2);
    if (w * h * s * s > MAX_PIXELS) s = Math.sqrt(MAX_PIXELS / (w * h));
    let pixelW = Math.max(1, Math.round(w * s));
    let pixelH = Math.max(1, Math.round(h * s));
    // L'arrotondamento può aggiungere pochi pixel oltre il tetto: rifacciamo la
    // scala una volta, così il prodotto dei due lati non lo supera mai.
    if (pixelW * pixelH > MAX_PIXELS) {
      s *= Math.sqrt(MAX_PIXELS / (pixelW * pixelH));
      pixelW = Math.max(1, Math.floor(w * s));
      pixelH = Math.max(1, Math.floor(h * s));
    }
    this.canvas.width = pixelW;
    this.canvas.height = pixelH;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.resize(w, h);
    this.camera.dpr = s;
    // Evita che il mirino resti nella vecchia orientazione. Anche sul desktop il
    // puntatore torna al centro; il prossimo movimento riprende subito il controllo.
    this.input.recenterAim(w, h);
  }

  async boot(onProgress) {
    this.resize();
    await onProgress('Disegno le strade della Corea…', 0.05);
    this.city = createRegion();

    await onProgress('Verniciano le carrozzerie…', 0.45);
    preloadSprites();

    await onProgress('Stampo le mappe turistiche…', 0.72);
    this.mapTexture = buildMapTexture(this.city);

    await onProgress('Accendo i semafori…', 0.88);
    this.scene = new Scene(this.city);
    this.player = new Player(this.city.spawn.x, this.city.spawn.y);
    this.player.district = this.city.districtAt(this.player.x, this.player.y);
    this.camera.snapTo(this.player.x, this.player.y);
    this.vehicleGrid = new DynamicGrid(this.city.w, this.city.h, 150);
    this.pedGrid = new DynamicGrid(this.city.w, this.city.h, 120);
    this.traffic = new TrafficSystem(this.city, this.rng, this.vehicles);
    this.pedSystem = new PedestrianSystem(this.city, this.rng, this.peds);
    // La vita degli altri: voli, navigazione, campagna, raduni e cronaca nera.
    // Ha un rng suo — pescare da `this.rng` sposterebbe lo streaming di traffico
    // e pedoni ogni volta che decolla un aereo.
    this.life = new LifeSystem(this.city, new Rng(20260808));
    // I personaggi nominati. Rng suo, come `life`: uno che compare non deve
    // spostare lo streaming di traffico e pedoni.
    this.actors = new ActorSystem(new Rng(20260809));
    this.actors.attach(this);
    // Il pedinamento e l'oggetto in mano: due meccaniche che l'Atto I chiede e che
    // tornano più avanti (M6, M9), quindi stanno nel motore e non in una missione.
    this.tail = new TailSystem();
    this.carry = new CarrySystem();
    // **Prima delle missioni**, e non è indifferente: quando si muore, quello che
    // si aveva in mano deve toccare terra prima che la fase si riapparecchi, o la
    // fase cercherebbe per terra una cosa che è ancora in mano a un cadavere.
    this.carry.attach(this);
    // Le missioni. Il motore non sa niente della trama: la trama gliela registra
    // `story/campaign.js`, che è l'unico file che le conosce tutte e dodici.
    this.missions = new MissionSystem();
    this.missions.attach(this);
    // La strada da fare fino al blip. Non è un sistema del mondo: non muove
    // niente e nessuno lo interroga durante un frame di gioco — lo leggono solo
    // la minimappa e la carta, che sono le due superfici su cui esiste.
    this.route = new RouteGuide(this.city);
    this.pickups = new PickupSystem(this.city, this.rng);
    this.projectiles = new ProjectileSystem();
    this.wanted = new WantedSystem();
    this.police = new PoliceSystem(this.city, this.rng);
    this.shops = new ShopSystem(this.city);
    // I cortili. È l'unico sistema che riscrive un dato di generazione — il
    // padrone di un territorio — e l'unico pezzo di mondo che una partita cambia
    // in modo permanente (§5.31).
    this.turfs = new TurfSystem(this.city);
    this.interiorScene = new InteriorScene(this.scene);
    this.hud = new Hud(this.city, this.mapTexture);
    this.mapView = new MapView(this.city, this.mapTexture);
    this.menu = new PauseMenu(this.mapView);
    this.startMenu = new StartMenu();
    this.shopMenu = new ShopMenu();
    this.metro = new MetroSystem();
    this.metroScene = new MetroScene(this.scene);
    // Dopo l'HUD: il filo del 병원 gli parla addosso al primo risveglio, e una
    // definizione di attore vuole i negozi già in piedi.
    registerCampaign(this);

    // Riempie subito la scena, così il giocatore non parte in una città deserta.
    this.traffic.placeSpecialVehicles(this);
    this.traffic.prewarm(this, 72, 32);
    this.pedSystem.prewarm(this, 64);

    this.stats.districts.add(this.districtKey(this.player.district));

    await onProgress('Pronti.', 1);
    this.loop = new Loop((dt) => this.update(dt), () => this.render());
    this.loop.start();
    // `?autostart` salta il menu iniziale: è come `probe.mjs` (§9) e le scene di
    // prova trovano il gioco in strada, esattamente come prima che il menu ci fosse.
    const probe = new URLSearchParams(window.location.search);
    if (probe.has('autostart')) this.start(false);
    // Hook di prova locale: mette il browser in scene ripetibili senza falsare il
    // percorso normale ingresso -> atrio -> tornelli. Il controllo automatico
    // può premere tasti ma non tenerli premuti per attraversare mezza città.
    const regionProbe = probe.get('regiontest');
    if (REGION_IDS.includes(regionProbe)) {
      if (!this.started) this.start(false);
      this.travelTo(regionProbe, null, { silent: true });
    }
    const metroProbe = probe.get('metrotest');
    if (['entrance', 'kiosk', 'platform'].includes(metroProbe)) {
      if (!this.started) this.start(false);
      const station = this.city.transitStations?.[0];
      if (station && metroProbe === 'entrance') {
        this.player.x = station.arrivalX;
        this.player.y = station.arrivalY;
        this.player.district = this.city.districtAt(this.player.x, this.player.y);
        this.player.enterCooldown = 0;
        this.camera.snapTo(this.player.x, this.player.y);
      } else if (station && this.metro.enterStation(this, station)) {
        const target = metroProbe === 'kiosk' ? this.metro.floor.kiosk : this.metro.floor.trainDoor;
        this.player.x = target.x;
        this.player.y = target.y + (metroProbe === 'kiosk' ? 0 : -24);
        this.player.enterCooldown = 0;
        this.camera.snapTo(this.metro.floor.w / 2, this.metro.floor.h / 2);
      }
    }
    if (probe.get('edgetest') === 'east') {
      if (!this.started) this.start(false);
      let edgeX = this.city.w - 78;
      while (edgeX > 96 && this.city.isWater(edgeX, this.city.h * 0.5)) edgeX -= 32;
      this.player.x = edgeX;
      this.player.y = this.city.h * 0.5;
      this.player.district = this.city.districtAt(this.player.x, this.player.y);
      this.camera.snapTo(this.player.x, this.player.y);
    }
  }

  /**
   * Si comincia. `loaded` dice se il mondo è già stato riscritto da un
   * salvataggio: in quel caso non si dà il benvenuto a chi sta *tornando*, e
   * soprattutto non si tocca niente di quello che `save.apply` ha appena messo
   * a posto.
   */
  start(loaded) {
    this.started = true;
    this.startMenu.open = false;
    this.camera.setZoomTarget(1);
    this.camera.snapTo(this.player.x, this.player.y);
    this.autoT = undefined;
    this.audio.music?.sting('go');
    this.hud.showDistrict(this.player.district);
    if (loaded) return;
    if (this.mobileControls?.active) {
      this.hud.toast('Stick sinistro: muoviti · stick destro: mira e spara', 5);
      this.hud.toast('L\'icona luminosa mostra l\'azione disponibile', 6.5);
      this.hud.toast('La radio compare quando sali su un mezzo', 8);
    } else {
      this.hud.toast('E per rubare un\'auto · M per la mappa', 5);
      this.hud.toast('Mouse per mirare e sparare · 1-6 per l\'arma', 6.5);
      this.hud.toast('E sulla porta di un negozio per entrare · F svuota la cassa', 8);
      // Che esista una radio è un comando, non un avviso di Kkachi: la regola 2
      // del copione vieta di segnalare *lui*, non di dire dov'è la manopola.
      this.hud.toast('R accende la radio quando sei alla guida', 9.5);
    }
  }

  /**
   * Svuota il mondo attorno al giocatore. Lo usano il caricamento di un
   * salvataggio e la partita nuova, che hanno lo stesso problema: quello che c'è
   * in strada adesso appartiene a una partita che fra un istante non esiste più.
   * Velivoli e imbarcazioni restano dove sono — nascono al boot e non passano
   * dallo streaming (§3), quindi nessuno li rifarebbe.
   */
  clearWorld() {
    // Prima `life`: tiene riferimenti a veicoli e pedoni che stanno per sparire, e
    // un evento sopravvissuto continuerebbe a dare ordini a dei fantasmi.
    this.life.clear(this);
    for (let i = this.vehicles.length - 1; i >= 0; i--) {
      const v = this.vehicles[i];
      if (v.protect && v.moored) continue;
      // Liberare lo stallo di sosta è obbligatorio, o resta occupato da un
      // fantasma per il resto della partita (§4).
      if (v.spot) v.spot.taken = false;
      this.vehicles.splice(i, 1);
    }
    // `gone` serve a chi tiene riferimenti ai pedoni: senza, la polizia
    // continuerebbe la caccia con degli agenti che non sono più in nessuna lista.
    for (const p of this.peds) p.gone = true;
    this.peds.length = 0;
    // Gli attori non si perdono: quello che sparisce è il loro pedone, e la
    // definizione (con la morte, se è morto) resta a `ActorSystem`.
    this.actors.clearPeds();
    this.police.standDown(this, true);
    this.projectiles.clear();
    this.fx.clear();
    this.pickups.reset();
    // Il mezzo pedinato era uno di quelli appena tolti dalla lista: un pedinamento
    // che sopravvive al mondo insegue un fantasma.
    this.tail?.stop();
    // L'itinerario è disegnato fra due punti che stanno per non voler più dire
    // niente (una partita caricata, un treno per Busan): si rifà al primo frame.
    this.route?.clear();
  }

  /**
   * Il treno. Dal §5.25 non c'è più una città da ricostruire — Seoul, Busan e
   * Jeju stanno nella stessa mappa — quindi restano il salto fra due fermate e
   * quello che va rimesso a posto attorno al giocatore: mondo svuotato, camera
   * riagganciata, streaming ripopolato dove si arriva. `regionId` sopravvive
   * perché i salvataggi e la rete metro lo passano ancora: qui significa
   * soltanto «la prima fermata di quell'area».
   */
  travelTo(regionId, stationId = null, opts = {}) {
    const fromArea = this.areaAt(this.player.x, this.player.y);
    if (this.indoors) this.leaveInterior();
    if (!this.player.onFoot && this.player.vehicle) {
      const v = this.player.vehicle;
      v.driver = null;
      this.player.vehicle = null;
      this.player.onFoot = true;
    }
    this.clearWorld();

    const stations = this.city.transitStations || [];
    const station = stations.find((s) => s.id === stationId)
      || stations.find((s) => s.region === regionId)
      || stations[0];
    const target = station || this.city.spawn;
    this.player.x = station ? station.arrivalX : target.x;
    this.player.y = station ? station.arrivalY : target.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.enterCooldown = 0.5;
    this.player.district = this.city.districtAt(this.player.x, this.player.y);
    this.stats.districts.add(this.districtKey(this.player.district));
    this.camera.snapTo(this.player.x, this.player.y);
    this.vehicleGrid.rebuild(this.vehicles);
    this.pedGrid.rebuild(this.peds);
    this.traffic.prewarm(this, 44, 20);
    this.pedSystem.prewarm(this, 48);
    this.mapView.open = false;
    this.menu.open = false;
    this.metro.open = false;
    this.hud.showDistrict(this.player.district);
    if (opts.silent) return;
    const toArea = this.areaAt(this.player.x, this.player.y);
    if (toArea && toArea.id !== fromArea?.id) {
      // Un interurbano costa tempo: il treno per Busan non è la metro di due
      // fermate, e il traghetto per Jeju ancora meno.
      this.dayCycle.advance(toArea.id === 'jeju' || fromArea?.id === 'jeju' ? 2 : 1.25);
      this.hud.toast(`Arrivo a ${toArea.hangul} ${toArea.name}`, 3.4);
    }
    if (station) this.hud.toast(`${station.hangul} · ${station.name}`, 2.4);
  }

  /** In quale delle tre città si trova un punto (null = campagna o mare). */
  areaAt(x, y) {
    return this.city.areaAt ? this.city.areaAt(x, y) : null;
  }

  /**
   * Chiave con cui una zona entra nelle statistiche. Gli id dei distretti sono
   * gli stessi in tutte e tre le città — è quello che tiene in piedi mercati e
   * salvataggi — quindi da soli conterebbero Gangnam e Haeundae come un posto solo.
   */
  districtKey(d) {
    const area = this.areaAt(this.player.x, this.player.y);
    return !area || area.id === 'seoul' ? d.id : `${area.id}:${d.id}`;
  }

  /**
   * Da capo, senza ricaricare la pagina. La città non c'entra: nasce da una seed
   * fissa e non è mai cambiata. Quello che va rimesso a posto è tutto il resto —
   * Jae-min, l'orologio, il ricercato, le statistiche e quel poco che gli interni
   * ricordano. Senza questo metodo «Nuova partita» dopo aver caricato un
   * salvataggio proseguiva la partita caricata, e «Esci al titolo» sarebbe stato
   * un `location.reload()` travestito.
   */
  newGame() {
    if (this.indoors) this.leaveInterior();
    this.clearWorld();
    this.player.reset(this.city.spawn.x, this.city.spawn.y);
    this.player.district = this.city.districtAt(this.player.x, this.player.y);
    this.wanted.reset();
    this.shops.reset();
    this.turfs.reset(this);
    this.actors.reset();
    this.missions.reset(this);
    this.kkachi.reset();
    this.tail.stop();
    this.carry.reset();
    this.markers.length = 0;
    this.dayCycle.reset();
    this.radio.off(this);
    this.time = 0;
    this.attractT = 0;
    this.autoT = undefined;
    Object.assign(this.stats, {
      distance: 0, topSpeed: 0, stolen: 0, crashes: 0, pedsHit: 0, kills: 0,
      deaths: 0, busted: 0, copsKilled: 0, maxWanted: 0, choppers: 0, blasts: 0,
      robberies: 0, visits: 0, districts: new Set([this.districtKey(this.player.district)]),
    });
    this.traffic.prewarm(this, 40, 18);
    this.pedSystem.prewarm(this, 40);
    // Le griglie si rifanno a ogni frame, ma il primo dopo la partita nuova
    // arriva *dopo* le collisioni del giocatore: senza questo si può nascere
    // dentro un'auto appena immessa (§4).
    this.vehicleGrid.rebuild(this.vehicles);
    this.pedGrid.rebuild(this.peds);
    this.camera.snapTo(this.player.x, this.player.y);
  }

  /**
   * Ritorno al titolo. È una partita nuova più il menu iniziale davanti: la
   * differenza con `newGame` è solo chi sta guardando, e infatti l'attract mode
   * riparte esattamente come al boot.
   */
  toTitle() {
    this.newGame();
    this.started = false;
    this.menu.open = false;
    this.mapView.open = false;
    this.shopMenu.open = false;
    this.startMenu.open = true;
    this.startMenu.focus = 'items';
    this.startMenu.tab = null;
    // L'elenco delle voci dipende da cosa c'è nel browser, e nel frattempo può
    // essere cambiato: chi è appena passato dal menu di pausa ha quasi sempre
    // salvato qualcosa.
    this.startMenu.refresh();
    // Il tema torna da solo: `music.direct` guarda `game.started` a ogni frame.
  }

  // --- bus di eventi ----------------------------------------------------------
  on(name, fn) { return this.events.on(name, fn); }
  once(name, fn) { return this.events.once(name, fn); }
  off(name, fn) { this.events.off(name, fn); }
  emit(name, ...args) { this.events.emit(name, ...args); }

  /**
   * In che modalità sta girando il gioco (`core/modes.js`). Si risolve a ogni
   * lettura ed è una manciata di predicati: chi lo chiede tre volte in un frame
   * non paga niente, e non c'è uno stato in più da tenere allineato.
   */
  get mode() {
    return resolveMode(this);
  }

  /**
   * Il mondo è fermo. Era una riga di `update` con quattro `or` dentro; adesso è
   * la modalità a dirlo. Chi legge questo campo non è cambiato, e una modalità in
   * più (un dialogo di missione, una schermata di fallimento) adesso è una riga in
   * `core/modes.js` invece di un quinto `or` qui e di un ramo in ognuno di loro.
   */
  get paused() {
    return !this.mode.worldRuns;
  }

  /**
   * L'apertura, e quello che viene dopo (`story/intro.js`). `start` lo chiama la
   * cutscene quando finisce — saltata o guardata che sia — così il passaggio di
   * consegne è uno solo e non due.
   */
  playIntro() {
    this.cutscene.play(this, INTRO, 'intro', (game) => {
      game.start(false);
      handoff(game);
      // Da qui parte M1 (`02-cutscene-iniziale.md`, «il passaggio di consegne»):
      // l'innesco è lo stesso di Kkachi — il motore acceso — e sta nella missione.
      beginCampaign(game);
    });
  }


  // --- marcatori sulla mappa --------------------------------------------------
  //
  // `game.markers` esisteva già ed era letto da `hud.drawMinimap` e da
  // `mapview.drawPanel`; quello che mancava era il modo di **scriverlo**. Un
  // marcatore ha un `id` perché il caso normale è spostarlo, non accumularlo: la
  // decisione presa con l'utente è **un blip solo, sulla missione in corso**.
  setMarker(id, x, y, opts = {}) {
    const mk = { id, x, y, ...opts };
    const i = this.markers.findIndex((m) => m.id === id);
    if (i >= 0) this.markers[i] = mk;
    else this.markers.push(mk);
    return mk;
  }

  clearMarker(id) {
    const i = this.markers.findIndex((m) => m.id === id);
    if (i >= 0) this.markers.splice(i, 1);
  }

  clearMarkers() {
    this.markers.length = 0;
  }

  /** True quando il giocatore è in un interno: negozio oppure stazione metro. */
  get indoors() {
    return !!((this.shops && this.shops.active) || (this.metro && this.metro.inside));
  }

  /** Pianta attiva condivisa da collisioni, camera e minimappa interna. */
  get interiorFloor() {
    if (this.metro?.inside) return this.metro.floor;
    return this.shops?.floor || null;
  }

  /** Chiude in modo sicuro qualunque interno senza lasciare coordinate locali. */
  leaveInterior() {
    if (this.metro?.inside) this.metro.forceExit(this);
    if (this.shops?.active) this.shops.forceExit(this);
  }

  /** Notte di gioco: la decide l'orologio, e da lì scendono fari, lampioni e insegne. */
  get isNight() {
    return this.dayCycle.isNight;
  }

  /**
   * Il rettangolo giocabile e i suoi solidi: la città, oppure la pianta del piano
   * in cui si è entrati. Collisioni a piedi e raggi delle armi passano di qui e
   * non hanno bisogno di sapere dove si trova il giocatore.
   */
  area() {
    if (this.indoors) {
      const f = this.interiorFloor;
      return { grid: f.grid, x0: 10, y0: 10, x1: f.w - 10, y1: f.h - 10 };
    }
    return { grid: this.city.solidGrid, x0: 40, y0: 40, x1: this.city.w - 40, y1: this.city.h - 40 };
  }

  // --- callback dal mondo ----------------------------------------------------
  //
  // Restano metodi, e restano i chiamanti di prima: `vehicle.js`, `player.js`,
  // `pedestrians.js`, `projectiles.js` e `shops.js` chiamano `game.onQualcosa`
  // esattamente come facevano. Quello che è cambiato è che ognuno finisce con un
  // `emit`, così chi vuole *osservare* un fatto — una fase di missione, una riga
  // di Kkachi — si iscrive invece di farsi aggiungere un `if` qui dentro.
  onDistrictChange(d) {
    this.hud.showDistrict(d);
    // **Nuovo prima di segnarlo**, e non è pignoleria: chi ascolta l'evento lo
    // riceve quando la zona è già in elenco, e una riga di Kkachi che dice «qui
    // non ci sei mai stato» non avrebbe più modo di saperlo.
    const key = this.districtKey(d);
    const first = !this.stats.districts.has(key);
    this.stats.districts.add(key);
    this.emit('districtChange', d, first);
  }

  onEnterVehicle(v) {
    this.stats.stolen++;
    v.protect = true;
    this.hud.toast(`${VEHICLE_TYPES[v.kind].label} acquisita`, 1.8);
    // Rubare un'auto vuota in un vicolo non lo denuncia nessuno; strapparla dalle
    // mani di qualcuno sotto gli occhi di un testimone sì, e a una pattuglia ancora
    // di più. **È una condizione del ricercato, non dell'evento**: qui c'era un
    // `return` anticipato, e siccome l'`emit` sta in fondo salire su un'auto vuota
    // non lo mandava a nessuno. Salire sulla berlina del padre — che è ferma e
    // vuota da una notte — non faceva partire M1, mentre rubarne una in corsa sì.
    let witness = false;
    if (v.occupiedTheft) {
      const cop = this.police.cops.some((p) => !p.dead && dist(p.x, p.y, v.x, v.y) < 420);
      witness = cop || this.pedGrid.queryCircle(v.x, v.y, 320).some((p) => !p.dead);
      if (cop) this.wanted.report('copTheft', this);
      else if (witness) this.wanted.report('theft', this);
    }
    // `witness` esce insieme all'evento perché **chi l'ha visto lo sa solo qui**:
    // un istante dopo la griglia dei pedoni è già un'altra, e ricalcolarlo altrove
    // vorrebbe dire riscrivere questa regola una seconda volta (§4).
    this.emit('enterVehicle', v, witness);
  }

  onExitVehicle(v) {
    v.protect = false;
    this.emit('exitVehicle', v);
  }

  onVehicleImpact(v, impact) {
    const isPlayer = v.driver === 'player';
    // Sotto i 30 px/s è lo strisciare di un paraurti in coda: farlo suonare
    // riempirebbe la strada di lamiere a ogni semaforo.
    if (impact > 30) this.audio.impact(v.x, v.y, impact);
    if (impact > 90) {
      this.fx.addSparks(v.x, v.y, -v.vx, -v.vy, Math.min(14, impact / 22));
      if (isPlayer) {
        this.camera.addShake(Math.min(14, impact / 26));
        this.stats.crashes++;
      }
    }
    if (impact > 40) this.fx.addDust(v.x, v.y, v.vx, v.vy, 3);
    this.emit('vehicleImpact', v, impact);
  }

  onVehicleDestroyed(v) {
    this.fx.addExplosion(v.x, v.y);
    this.audio.explosion(v.x, v.y, 1.15);
    if (dist(v.x, v.y, this.player.x, this.player.y) < 900) {
      this.camera.addShake(18);
    }
    if (v.driver === 'player') {
      this.player.exitVehicle(this, true);
      this.player.damage(42, 0, 0, this);
    }
    // Onda d'urto: chi è troppo vicino non se la racconta.
    for (const p of this.pedGrid.queryCircle(v.x, v.y, 100)) {
      if (p.dead) continue;
      const d = dist(p.x, p.y, v.x, v.y) || 1;
      if (d > 100) continue;
      this.pedSystem.hurt(p, 130 - d, (p.x - v.x) / d, (p.y - v.y) / d, this, null, 300);
    }
    const pd = dist(this.player.x, this.player.y, v.x, v.y);
    if (this.player.onFoot && pd < 110) {
      this.player.damage(60 - pd * 0.3, (this.player.x - v.x) / (pd || 1), (this.player.y - v.y) / (pd || 1), this);
    }
    this.pedSystem.alarm(v.x, v.y, 700, this, null);
    // Far saltare una macchina è un reato solo se l'hai fatta saltare tu: le
    // carambole del traffico non devono mandare la centrale in allarme.
    if (v.lastAttacker === this.player) this.wanted.report('wreck', this);
    v.protect = false;
    this.emit('vehicleDestroyed', v);
  }

  /**
   * Un mezzo di terra finito in acqua. Non è un'esplosione: è uno spruzzo, il
   * relitto che cala e chi era al volante che annega. La macchina va tolta subito
   * dalla lista, altrimenti resta a galleggiare in fondo al Han per tutta la partita.
   */
  onVehicleSunk(v) {
    this.fx.addSplash(v.x, v.y, 22, 1.6);
    this.audio.splash(v.x, v.y, 1.6);
    if (v.driver === 'player') {
      this.player.exitVehicle(this, true);
      this.hud.toast('Sei finito in acqua', 2.4);
      this.player.die(this);
    }
    v.dead = true;
    v.deadT = 24;      // lo streaming lo raccoglie al prossimo giro
    v.protect = false;
    // Togliere il veicolo dalla lista non libera il suo stallo di sosta: senza
    // questo, il posto resta occupato da un fantasma per il resto della partita.
    if (v.spot) v.spot.taken = false;
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    this.emit('vehicleSunk', v);
  }

  onPedKilled(p, v, speed, source) {
    this.stats.pedsHit++;
    if (source === this.player) this.stats.kills++;
    if (source === this.player || (v && v.driver === 'player')) {
      if (p.cop) {
        this.stats.copsKilled++;
        this.wanted.report('copKill', this);
      } else {
        this.wanted.report('kill', this);
      }
    }
    this.fx.addBlood(p.x, p.y, clamp(speed / 220, 0.5, 1.6));
    this.audio.bodyFall(p.x, p.y);
    // Investito, non colpito: il grido è quello di chi ha visto la macchina
    // arrivare. Chi muore di piombo cade e basta.
    if (v && Math.random() < 0.6) this.audio.scream(p.x, p.y, p.voice, true);
    if (v) {
      this.fx.addDust(p.x, p.y, v.vx, v.vy, 3);
      if (v.driver === 'player') this.camera.addShake(6);
    }
    this.emit('pedKilled', p, v, source);
  }

  /**
   * Manopola della radio. Sta qui e non in `player` perché si usa in due posti —
   * al volante e dentro un locale — e in nessuno dei due è un'azione del
   * personaggio. Premerla dove non si sentirebbe niente lo dice, invece di
   * aprire uno stream muto.
   */
  updateRadioKeys() {
    if (!this.input.wasPressed('KeyR') || this.paused) return;
    const shift = this.input.anyDown('ShiftLeft', 'ShiftRight');
    const inCar = !this.player.onFoot && this.player.vehicle;
    const inShop = this.indoors && this.shops.floor?.openNow && this.shops.floor?.biz.radio;
    if (!inCar && !inShop) {
      this.hud.toast('La radio è in macchina (o in un locale che ce l\'ha)', 1.8);
      return;
    }
    if (shift) {
      this.radio.off(this);
    } else {
      this.radio.next(this);
      // `inCar` perché Kkachi sta nel motore: la radio di un 편의점 non è la sua.
      this.emit('radioOn', !!inCar);
    }
  }

  onPlayerDeath() {
    this.stats.deaths++;
    this.camera.addShake(16);
    this.audio.playerDown();
    this.emit('playerDeath');
  }

  // --- combattimento ---------------------------------------------------------
  damagePed(p, dmg, dx, dy, source, knock = 0) {
    this.pedSystem.hurt(p, dmg, dx, dy, this, source, knock);
  }

  damagePlayer(dmg, dx, dy) {
    this.player.damage(dmg, dx, dy, this);
  }

  damageVehicle(v, dmg, x, y, source) {
    this.fx.addSparks(x, y, -v.vx, -v.vy, 2);
    if (v.dead) return;
    if (source) v.lastAttacker = source;
    v.hp -= dmg;
    v.awake = true;
    if (v.hp <= 0) {
      v.dead = true;
      this.onVehicleDestroyed(v);
    }
  }

  /** Uno sparo si sente: i pedoni nel raggio reagiscono — quelli del piano, se dentro. */
  alarm(x, y, r, source) {
    if (this.shops?.active) this.shops.alarm(x, y, r, this, source);
    else if (this.metro?.inside) return;
    else this.pedSystem.alarm(x, y, r, this, source);
  }

  /** Risveglio all'ospedale del distretto più vicino, senza arsenale. */
  respawnPlayer() {
    const pl = this.player;
    // Se si muore dentro un negozio la barella arriva lo stesso: l'interno si
    // chiude prima di spostare il giocatore, o resterebbe in un limbo con le
    // coordinate della pianta.
    if (this.indoors) this.leaveInterior();
    let best = this.city.hospitals[0];
    let bestD = Infinity;
    for (const h of this.city.hospitals) {
      const d = dist(h.x, h.y, pl.x, pl.y);
      if (d < bestD) { bestD = d; best = h; }
    }
    pl.revive(best.x, best.y);
    pl.angle = Math.PI / 2;
    // In corsia il ricercato si azzera: è il prezzo già pagato con la morte, e
    // svegliarsi con quattro stelle addosso sarebbe una condanna senza uscita.
    this.wanted.reset();
    this.police.standDown(this, true);
    this.camera.snapTo(pl.x, pl.y);
    this.fx.clear();
    // Le mine restano armate anche dopo la morte di chi le ha messe: al risveglio
    // in corsia si troverebbe il quartiere minato e nessun modo di saperlo.
    this.projectiles.clear();
    pl.district = this.city.districtAt(pl.x, pl.y);
    this.hud.showDistrict(pl.district);
    // In corsia si paga: un quarto dei contanti. È il costo della morte adesso che
    // i soldi servono a qualcosa, e non svuota le tasche a chi ha appena cominciato.
    const bill = Math.round(pl.money * 0.25);
    pl.money -= bill;
    this.hud.toast(`Ospedale di ${best.name}: ti hanno ricucito, l'arsenale no`, 4);
    if (bill > 0) this.hud.toast(`Conto della clinica: ${won(bill)}`, 4);
    this.emit('respawn', best);
    // Uscire dall'ospedale è un punto pulito: niente stelle, HP pieni, in piedi
    // davanti a una porta. Se una sconfitta non si salva qui, l'unico modo di
    // riavere quello che si aveva prima è non ricaricare mai.
    autosave(this, 'ospedale');
  }

  /**
   * Arrestato. È la seconda sconfitta del gioco, e deve **costare in modo
   * diverso** dalla prima o tanto varrebbe morire: l'ospedale si prende un
   * quarto dei contanti e ti rimette in piedi subito, la cella si prende meno
   * denaro (un quinto, la cauzione) ma **sei ore**. Perdere una notte di Seoul
   * è un prezzo che il gioco sa già far sentire — cambia la luce, cambia il
   * tempo, chiudono i locali — e non ne serviva uno nuovo.
   *
   * L'arsenale è confiscato come in corsia: `revive` fa già esattamente questo.
   */
  bustPlayer() {
    const pl = this.player;
    if (this.indoors) this.leaveInterior();
    // In campagna e all'aeroporto non ci sono commissariati: lì ti portano
    // all'ospedale del distretto, che è l'unico edificio pubblico che c'è.
    const places = this.city.stations.length ? this.city.stations : this.city.hospitals;
    let best = places[0];
    let bestD = Infinity;
    for (const s of places) {
      const d = dist(s.x, s.y, pl.x, pl.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    const bail = Math.round(pl.money * 0.2);
    pl.revive(best.x, best.y);
    pl.money -= bail;
    pl.angle = Math.PI / 2;
    this.stats.busted = (this.stats.busted || 0) + 1;
    this.wanted.reset();
    this.police.standDown(this, true);
    this.camera.snapTo(pl.x, pl.y);
    this.fx.clear();
    this.projectiles.clear();
    // Sei ore di cella: l'orologio va *fatto girare*, non spostato, o il meteo
    // all'uscita sarebbe quello di quando sei entrato (§5.11).
    this.dayCycle.advance(6);
    pl.district = this.city.districtAt(pl.x, pl.y);
    this.hud.showDistrict(pl.district);
    this.audio.playerDown();
    this.audio.music?.sting('busted');
    this.hud.toast(`Arrestato — commissariato di ${best.name}`, 4);
    this.hud.toast('Sei ore dentro, e l\'arsenale se lo tengono', 4);
    if (bail > 0) this.hud.toast(`Cauzione: ${won(bail)}`, 4);
    this.emit('busted', best);
    autosave(this, 'uscito di cella');
  }

  // --- ciclo ----------------------------------------------------------------
  update(dt) {
    const input = this.input;
    this.mobileControls?.update(dt);
    // In background non avanza niente: né mondo, né titolo, né tavole automatiche.
    // Il primo frame visibile riparte dallo stesso stato e senza input trattenuti.
    if (this.hidden) {
      this.audio.update(dt, this);
      input.endFrame();
      return;
    }
    // I pannelli sono l'unica modalità in cui il mondo non gira *e* qualcosa si
    // muove lo stesso. Gira solo la cutscene e l'audio: i letti si abbassano da
    // soli leggendo `mode.duck` e la musica passa al tema dell'apertura.
    if (this.cutscene.active) {
      this.cutscene.update(dt, this);
      this.audio.update(dt, this);
      input.endFrame();
      return;
    }
    if (!this.started) {
      this.updateAttract(dt);
      return;
    }
    // Un dialogo ferma il mondo come un menu ma **non lo copre**: la città resta
    // disegnata sotto, quindi qui gira solo il riquadro (e l'audio, che si abbassa
    // da solo leggendo `mode.duck`). L'HUD continua ad aggiornarsi, o i toast
    // scritti dalla battuta prima resterebbero appesi.
    if (this.dialogue.active) {
      this.dialogue.update(dt, this);
      this.audio.update(dt, this);
      this.radio.update(dt, this);
      this.hud.update(dt);
      input.endFrame();
      return;
    }

    if (input.wasPressed('Escape')) {
      // `backOut` è il pannello audio del menu: ESC lì dentro torna alle voci
      // invece di chiudere tutto.
      if (this.metro.open) this.metro.close(this);
      else if (this.shopMenu.open) this.shopMenu.close(this);
      else if (this.mapView.open) { this.mapView.open = false; this.audio.ui('close'); }
      else if (!this.menu.backOut()) { this.menu.toggle(); this.audio.ui(this.menu.open ? 'open' : 'close'); }
      else this.audio.ui('close');
    }
    // La mappa della città non serve dentro un negozio: le coordinate sono quelle
    // della pianta, e il puntino finirebbe in un angolo di Seoul a caso.
    if (input.wasPressed('KeyM') && !this.shopMenu.open && !this.metro.open && !this.indoors) {
      if (this.menu.open) this.menu.open = false;
      this.mapView.toggle();
      this.audio.ui(this.mapView.open ? 'open' : 'close');
    }
    if (input.wasPressed('F3')) this.debug = !this.debug;
    if (input.wasPressed('F4')) {
      this.hud.toast(this.audio.toggleMute() ? 'Audio: muto' : 'Audio: acceso', 1.6);
    }

    const canUseMetro = this.metro.open || (!this.menu.open && !this.mapView.open && !this.shopMenu.open);
    const metroUsed = canUseMetro ? this.metro.update(dt, this) : false;
    this.updateRadioKeys();
    // L'audio gira anche in pausa: i letti si abbassano invece di spegnersi (uno
    // stacco netto suona come un guasto) e i suoni dei menu restano a volume pieno.
    this.audio.update(dt, this);
    this.radio.update(dt, this);
    const cursor = this.mode.cursor;
    if (this.canvas.style.cursor !== cursor) this.canvas.style.cursor = cursor;

    if (this.paused || metroUsed) {
      this.menu.update(dt, this);
      this.mapView.update(dt, this);
      this.shopMenu.update(dt, this);
      this.hud.update(dt);
      input.endFrame();
      return;
    }

    this.time += dt;
    // L'orologio è l'unico sistema che gira anche dentro un negozio. Un orologio
    // che si ferma è un orologio a cui il giocatore smette di credere, e restare
    // al riparo aspettando che faccia giorno deve poter funzionare.
    this.dayCycle.update(dt);
    this.trafficScale = this.dayCycle.trafficScale;
    this.pedScale = this.dayCycle.pedScale;
    if (this.dayCycle.isNight !== this._wasNight) this.switchLights();

    this.vehicleGrid.rebuild(this.indoors ? NO_VEHICLES : this.vehicles);
    this.pedGrid.rebuild(this.peds);

    const prevX = this.player.x;
    const prevY = this.player.y;

    // **Prima dei negozi**, e non per eleganza: un punto di missione e una porta
    // possono stare nello stesso metro quadro, e chi consuma il tasto per primo
    // alza `enterCooldown`, che è quello che fa desistere l'altro. Quando il
    // giocatore è lì per la missione, la missione vince.
    // Prima delle missioni: se il pedinamento finisce in questo frame, la fase che
    // lo ascolta lo sa adesso e non al giro dopo.
    this.tail.update(dt, this);
    this.carry.update(dt, this);
    this.missions.update(dt, this);
    // Subito dopo, e prima dei negozi: una fase che è appena cambiata ha già
    // spostato il blip, e l'itinerario che si disegna in questo frame è quello
    // della meta nuova. Dentro un edificio si ferma da sé (`route.update`).
    this.route.update(dt, this);
    // Poi i cortili, e **prima dei negozi** per la stessa ragione delle missioni:
    // dentro lo stesso recinto stanno il banco della banda e la busta del cortile,
    // e chi consuma il tasto per primo alza `enterCooldown`. I due tasti sono
    // diversi apposta (`E` il banco, `F` la busta), ma l'ordine resta quello.
    this.turfs.update(dt, this);
    // I negozi girano poi: decidono se il frame si svolge in strada o dentro
    // un edificio, e il giocatore deve muoversi già nello spazio giusto.
    if (this.metro.inside) {
      this.shops.actions.length = 0;
      this.shops.near = null;
    } else {
      this.shops.update(dt, this);
    }
    this.player.update(dt, this);
    // Dentro un edificio la città si ferma — traffico, pedoni, raccolte — e il
    // ricercato **resta congelato**: se si raffreddasse, la porta diventerebbe il
    // nascondiglio che §5.8 non vuole. La polizia è l'unica eccezione: continua a
    // lavorare, ma sulla porta invece che sul giocatore (`police.siege`), perché
    // uscire dopo un minuto e ritrovare la strada com'era è la scena che manca.
    if (!this.indoors) {
      // Il ricercato legge l'avvistamento calcolato dalla polizia, la polizia scrive
      // gas e sterzo delle volanti: la fisica di quei veicoli la integra `traffic`,
      // che deve girare dopo.
      this.wanted.update(dt, this);
      this.police.update(dt, this);
      // Come la polizia: `life` scrive gas e sterzo dei mezzi che pilota (aerei,
      // barche, trattori, l'auto della fuga e le volanti di quartiere), e la
      // fisica gliela integra `traffic` — che quindi deve girare dopo.
      this.life.update(dt, this);
      this.traffic.update(dt, this);
      this.pedSystem.update(dt, this);
      // Dopo lo streaming dei pedoni: `stream` ha appena tolto dalla lista chi era
      // troppo lontano, e chi ha un nome va rimesso al suo posto subito, non al
      // frame dopo — o per un frame il banco è vuoto.
      this.actors.update(dt, this);
      this.pickups.update(dt, this);
    } else if (this.shops.active) {
      this.police.siege(dt, this);
    }
    // Gli esplosivi girano anche dentro: una granata in un 노래방 rimbalza sui
    // tramezzi e fa danno a chi c'è. Quello che *non* può fare è sopravvivere alla
    // porta, e infatti `shops` svuota la lista a ogni passaggio (mine comprese).
    this.projectiles.update(dt, this);
    this.fx.update(dt, this);
    // Kkachi guarda la sua tabella due volte al secondo, e solo mentre il mondo
    // gira: un menu aperto mette in pausa la battuta, scendere dall'auto la perde
    // (regola 5). Sta qui in fondo perché non muove niente — legge e basta.
    this.kkachi.update(dt, this);
    this.hud.update(dt);
    tickAutosave(dt, this);

    // Statistiche di guida. Entrare e uscire da una porta è un salto di coordinate,
    // non un chilometro percorso: durante lo stacco non si conta.
    if (!this.indoors && this.shops.fade < 0.5) {
      this.stats.distance += dist(prevX, prevY, this.player.x, this.player.y);
    }
    const sp = this.player.onFoot ? 0 : Math.abs(this.player.vehicle?.speed || 0);
    if (sp > this.stats.topSpeed) this.stats.topSpeed = sp;

    if (!this.indoors) this.emitSkids(dt);

    // Col mirino del fucile di precisione la camera non sta più addosso al
    // giocatore: se lo decide `player.cameraTarget`.
    this.camera.follow(this.player.cameraTarget(this), dt, this.player.onFoot ? 0.2 : 0.4);

    input.endFrame();
  }

  /**
   * Menu iniziale: Seoul gira dietro al titolo. Girano traffico, pedoni ed
   * effetti — cioè tutto quello che si vede — e restano fermi il giocatore (non
   * risponde ai comandi finché non si comincia) e **l'orologio**: dieci minuti
   * passati a leggere il menu sono dieci ore di gioco, e la partita comincerebbe
   * a un'ora decisa da quanto ci si è messi a premere Invio.
   *
   * La camera gira piano attorno al punto di partenza e non si allontana: lo
   * streaming immette il traffico attorno al **giocatore** (§3), e una camera che
   * scappasse via inquadrerebbe strade vuote con le auto che svaniscono in vista.
   */
  updateAttract(dt) {
    this.audio.update(dt, this);
    this.radio.update(dt, this);
    if (this.canvas.style.cursor !== 'default') this.canvas.style.cursor = 'default';
    this.startMenu.update(dt, this);
    if (this.started) { this.input.endFrame(); return; }

    this.vehicleGrid.rebuild(this.vehicles);
    this.pedGrid.rebuild(this.peds);
    // Anche dietro al titolo la gente vive: un aereo che passa e un capannello
    // sull'angolo sono metà di quello che si vede da qui.
    this.life.update(dt, this);
    this.traffic.update(dt, this);
    this.pedSystem.update(dt, this);
    this.fx.update(dt, this);
    this.hud.update(dt);
    this.emitSkids(dt);

    this.attractT += dt;
    const a = this.attractT * 0.16;
    this.camera.setZoomTarget(0.92);
    this.camera.follow({
      x: this.player.x + Math.cos(a) * 250,
      y: this.player.y + Math.sin(a) * 170,
    }, dt, 0);
    this.input.endFrame();
  }

  /**
   * Cala la sera: si accendono i fari di quello che è già in strada. Si fa al
   * cambio di fase e non a ogni frame perché `lightsOn` è anche una scelta del
   * giocatore (`player.updateDriving`), e riscriverla di continuo gliela toglierebbe.
   */
  switchLights() {
    this._wasNight = this.dayCycle.isNight;
    for (const v of this.vehicles) {
      if (v.driver !== 'player') v.lightsOn = this._wasNight;
    }
    const place = this.areaAt(this.player.x, this.player.y)?.name || 'Corea';
    this.hud.toast(this._wasNight ? `Cala la sera su ${place}` : `Sorge il sole su ${place}`, 3);
  }

  /** Tracce di gomma per i veicoli che slittano nei paraggi. */
  emitSkids(dt) {
    this._skidT -= dt;
    if (this._skidT > 0) return;
    this._skidT = 0.035;
    for (const v of this.vehicles) {
      if (v.dead || v.slip < 42) continue;
      if (dist(v.x, v.y, this.player.x, this.player.y) > 800) continue;
      const spec = VEHICLE_TYPES[v.kind];
      const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
      const bx = v.x - cos * spec.len * 0.3;
      const by = v.y - sin * spec.len * 0.3;
      const strength = clamp((v.slip - 42) / 160, 0, 1);
      for (const s of [-1, 1]) {
        this.fx.addSkid(
          bx - sin * spec.wid * 0.42 * s,
          by + cos * spec.wid * 0.42 * s,
          v.angle,
          strength
        );
      }
      if (strength > 0.5 && Math.random() < 0.4) {
        this.fx.addSmoke(bx, by, 1, 0.5);
      }
    }
    // Cerchioni sull'asfalto: chi ha preso i chiodi lascia una scia di scintille.
    for (const v of this.vehicles) {
      if (!v.flatTires || v.dead || Math.abs(v.speed) < 35) continue;
      if (dist(v.x, v.y, this.player.x, this.player.y) > 700) continue;
      const spec = VEHICLE_TYPES[v.kind];
      const cos = Math.cos(v.angle), sin = Math.sin(v.angle);
      this.fx.addSparks(v.x - cos * spec.len * 0.3, v.y - sin * spec.len * 0.3, -v.vx, -v.vy, 2);
    }
  }

  render() {
    const ctx = this.ctx;
    // Sotto i pannelli c'è il nero pieno della tavola: disegnare anche la città
    // sarebbe un frame intero buttato via.
    if (this.cutscene.active) {
      this.camera.applyUI(ctx);
      this.cutscene.draw(ctx, this);
      return;
    }
    if (this.metro.inside) this.metroScene.render(ctx, this);
    else if (this.indoors) this.interiorScene.render(ctx, this);
    else this.scene.render(ctx, this);
    this.camera.applyUI(ctx);
    if (!this.started) {
      this.startMenu.draw(ctx, this);
      return;
    }
    this.hud.draw(ctx, this);
    // Sopra l'HUD e sotto i menu: è una cosa che succede in strada, non un
    // pannello. Il mondo continua a girare mentre si legge.
    drawRadioCall(ctx, this);
    this.mapView.draw(ctx, this);
    this.menu.draw(ctx, this);
    this.shopMenu.draw(ctx, this);
    this.metro.draw(ctx, this);
    // Per ultimo: il riquadro delle battute sta sopra tutto, HUD compreso.
    this.dialogue.draw(ctx, this);
  }
}

// --- avvio ------------------------------------------------------------------
const canvas = document.getElementById('game');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const loadingBar = document.getElementById('loading-bar');

const game = new Game(canvas);
window.game = game; // comodo per ispezionare da console

function progress(text, value) {
  loadingText.textContent = text;
  loadingBar.style.width = `${Math.round(value * 100)}%`;
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

game.boot(progress).then(() => {
  loading.classList.add('done');
  setTimeout(() => loading.remove(), 700);
}).catch((err) => {
  loadingText.textContent = `Errore: ${err.message}`;
  console.error(err);
});
