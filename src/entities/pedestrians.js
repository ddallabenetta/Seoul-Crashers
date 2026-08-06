// Pedoni: camminano sull'anello di marciapiede degli isolati, attraversano sulle
// strisce, entrano in panico se un'auto li sfiora e vengono investiti se non fanno in tempo.
import { PED_KINDS } from '../render/sprites.js';
import { SIDEWALK } from '../world/citygen.js';
import { DISTRICT_BY_ID } from '../world/districts.js';
import { angleDiff, approachAngle, clamp, dist, damp, circleRectPush } from '../core/math.js';
import { WEAPONS, shoot, meleeSwing, hasLineOfSight } from './weapons.js';

const BASE_MAX = 62;
// Distanza a cui un teppista armato apre il fuoco, e quella a cui uno disarmato
// smette di correre e comincia a menare.
const GUN_RANGE = 330;
const FIST_RANGE = 34;

// Sotto questa pioggia chi non ha l'ombrello smette di vagare e si infila sotto
// una tettoia. Chi l'ombrello ce l'ha tira dritto: è per quello che se lo porta.
const RAIN_SHELTER = 0.35;
// Quanto lontano si va a cercare un portone. Più in là si arriva zuppi lo stesso
// e si attraversa mezzo quartiere in mezzo al traffico.
const SHELTER_REACH = 340;
// Un portone è una sosta, non un parcheggio: scaduto il tempo si riprende la
// strada. Senza questo tetto i marciapiedi si svuotano una volta sola e restano
// vuoti per tutto il temporale — e i fermi occupano il tetto dello streaming al
// posto di chi cammina.
const SHELTER_MAX = 40;
// Quanto si affretta il passo sotto l'acqua. Poco: un marciapiede al piccolo
// trotto si legge come panico, non come pioggia.
const RAIN_HURRY = 0.12;

/** Tinte degli ombrelli. La trasparente è quella coreana per eccellenza. */
export const UMBRELLAS = ['#1c2029', '#2f4f7a', '#8c2f3c', '#3f6b4a', '#d9dde4', '#b8b0d8'];

/** Anello di streaming: i pedoni nascono appena oltre il bordo dello schermo. */
function ringFor(game) {
  const cam = game.camera;
  const viewR = Math.hypot(cam.viewW, cam.viewH) / (2 * cam.zoom);
  return { min: 0, max: Math.max(viewR + 380, viewR * 1.7), despawn: Math.max(viewR + 760, viewR * 2.4) };
}

/** True se il punto è fuori dal rettangolo inquadrato (con margine). */
function outsideView(game, x, y, margin = 60) {
  const b = game.camera.bounds(margin);
  return x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h;
}


let nextId = 1;

export function createPed(kind, x, y, rng) {
  const k = PED_KINDS[kind] || PED_KINDS.civil;
  // Solo chi reagisce può essere armato: un impiegato che estrae la pistola in
  // mezzo alla folla non è il tono che vogliamo, un teppista di Baekho sì.
  const armed = !!k.fights && rng.chance(0.45);
  return {
    id: nextId++,
    kind,
    x, y,
    angle: rng.range(-3.14, 3.14),
    vx: 0, vy: 0,
    animT: rng.range(0, 8),
    colorIndex: rng.int(0, k.coats.length - 1),
    baseSpeed: k.speed * rng.range(0.85, 1.15),
    state: 'walk',
    block: null,
    side: 0,
    t: 0,
    dirSign: rng.chance(0.5) ? 1 : -1,
    panic: 0,
    idleT: 0,
    hp: k.hp || 30,
    maxHp: k.hp || 30,
    dead: false,
    deadT: 0,
    spin: 0,
    hostile: false,
    armed,
    turf: null,       // territorio presidiato: lo guida lo stato `guard`
    dealer: false,    // 거래책: l'uomo con cui si tratta (vedi `spawnTurf`)
    cop: false,       // in servizio: lo stato lo guida `police.copBehavior`
    copWeapon: null,
    gone: false,      // despawnato dallo streaming (vedi `stream`)
    fireT: 0,
    bleedT: 0,
    crossX: 0,
    crossY: 0,
    // Chi si porta dietro l'ombrello. Si decide alla nascita e non quando
    // comincia a piovere: in una visuale dall'alto un passante sotto l'acqua
    // *è* un ombrello, e vederli comparire tutti insieme sopra le teste
    // tradirebbe che sono un effetto e non una cosa che la gente ha con sé.
    umbrella: rng.chance(0.62) ? rng.int(0, UMBRELLAS.length - 1) : -1,
    // Chi, restando a mani nude sotto l'acqua, si infila sotto una tettoia invece
    // di rassegnarsi. Come per l'ombrello si decide alla nascita, e per la stessa
    // ragione: vedere tutti muoversi nello stesso istante tradirebbe l'effetto.
    shy: rng.chance(0.75),
    shelterCd: rng.range(0, 7),   // sfasa anche la prima corsa al riparo
    shelterT: 0,
    shelterX: 0, shelterY: 0, shelterA: 0,
    // Soglia di pioggia sotto la quale *questo* pedone decide che è passata: chi
    // esce prima e chi aspetta l'ultima goccia.
    rainOut: rng.range(0.08, 0.3),
  };
}

/**
 * Chi può fare il 거래책 di un territorio. Il criterio è **dov'è**, non come si
 * sente: chiedere `state === 'guard'` sembrava più sicuro e chiudeva il banco al
 * primo spavento — un'auto che accosta, un tamponamento a due isolati, un allarme
 * — cioè quasi sempre. Fuori dal recinto invece non si tratta davvero: uno che sta
 * scappando per strada non è il contatto di nessuno.
 */
export function canDeal(t, d) {
  return !!d && !d.dead && !d.gone && !d.hostile && d.turf === t
    && d.x > t.x - 80 && d.x < t.x + t.w + 80
    && d.y > t.y - 80 && d.y < t.y + t.h + 80;
}

function dealerLost(t) {
  return !canDeal(t, t.dealer);
}

/**
 * Il contatto va rimpiazzato, ma non subito se lo hai steso tu. Senza rimpiazzo un
 * territorio resta senza banco per il resto della partita appena lo streaming si
 * porta via il 거래책 — e succede da solo, standogli lontano un minuto. Con un
 * rimpiazzo istantaneo, invece, sparargli non costerebbe niente.
 */
const DEALER_WAIT = 18;

function refreshDealer(t, peds, dt) {
  if (!dealerLost(t)) { t.dealerT = 0; return; }
  // Steso: si aspetta. Sparito dallo streaming: subentra il primo che c'è.
  const killed = t.dealer && t.dealer.dead;
  t.dealerT = (t.dealerT || 0) + dt;
  if (killed && t.dealerT < DEALER_WAIT) return;
  for (const p of peds) {
    if (!canDeal(t, p)) continue;
    if (t.dealer) t.dealer.dealer = false;
    t.dealer = p;
    p.dealer = true;
    t.dealerT = 0;
    return;
  }
}

/** Punto centrale del marciapiede per lato/t di un isolato. */
function sidewalkPoint(block, side, t, out = {}) {
  const m = SIDEWALK * 0.78;
  switch (side) {
    case 0: out.x = block.x + t * block.w; out.y = block.y + m; break;
    case 1: out.x = block.x + block.w - m; out.y = block.y + t * block.h; break;
    case 2: out.x = block.x + t * block.w; out.y = block.y + block.h - m; break;
    default: out.x = block.x + m; out.y = block.y + t * block.h; break;
  }
  return out;
}

function sideLength(block, side) {
  return side === 0 || side === 2 ? block.w : block.h;
}

export class PedestrianSystem {
  constructor(city, rng, peds) {
    this.city = city;
    this.rng = rng;
    this.peds = peds;
    this.tmp = {};
    this.spawnTimer = 0;
    this._sq = [];   // scratch per la ricerca dei portoni
  }

  /**
   * Chi entra in un territorio con un ferro in mano se ne accorge. La soglia è
   * volutamente bassa — arma diversa dai pugni, oppure già ricercato — perché una
   * banda che ti lascia passeggiare in mezzo ai suoi affari non è una banda.
   * Passarci disarmati e in fretta si può: è l'unica via per andare a trattare.
   */
  watchTurfs(game, dt = 0) {
    const pl = game.player;
    for (const t of this.city.turfs || []) refreshDealer(t, this.peds, dt);
    if (pl.dying) return;
    const provoking = pl.weapon !== 'fists' || (game.wanted && game.wanted.level > 0);
    for (const t of this.city.turfs || []) {
      const inside = pl.x > t.x - 40 && pl.x < t.x + t.w + 40 && pl.y > t.y - 40 && pl.y < t.y + t.h + 40;
      if (inside && !t.warned) {
        t.warned = true;
        // Il mestiere della banda si legge entrando: è l'unico posto in cui il
        // giocatore può scoprire che qui si commercia, e perché adesso non può.
        game.hud.toast(`${t.hangul} · ${t.trade} — ${t.place}`, 3);
        if (provoking) game.hud.toast('Con questa addosso non trattano', 2.8);
      } else if (!inside && t.warned && dist(pl.x, pl.y, t.cx, t.cy) > 700) {
        t.warned = false;
      }
      if (!inside || !provoking) continue;
      for (const p of this.peds) {
        if (p.turf !== t || p.dead || p.hostile) continue;
        p.hostile = true;
        p.state = 'hostile';
      }
    }
  }

  update(dt, game) {
    this.stream(dt, game);
    this.watchTurfs(game, dt);
    for (const p of this.peds) this.updatePed(p, dt, game);
  }

  /** Riempie i marciapiedi al primo avvio, anche in campo visivo. */
  prewarm(game, count = 60) {
    for (let i = 0; i < count * 4 && this.peds.length < count; i++) {
      this.spawnNear(game.player, game, { min: 60, max: 1200, allowVisible: true });
    }
  }

  stream(dt, game) {
    const pl = game.player;
    const ring = ringFor(game);
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.dead) {
        p.deadT += dt;
        if (p.deadT > 30) { p.gone = true; this.peds.splice(i, 1); continue; }
      }
      // `gone` serve a chi tiene riferimenti ai pedoni (la polizia): un agente
      // despawnato dallo streaming non deve restare a fare la caccia da fantasma.
      if (dist(p.x, p.y, pl.x, pl.y) > ring.despawn) {
        p.gone = true;
        this.peds.splice(i, 1);
      }
    }

    const district = this.city.districtAt(pl.x, pl.y);
    const max = Math.round(BASE_MAX * (district.pedDensity || 1) * game.pedScale);
    this.spawnTimer -= dt;
    if (this.peds.length < max && this.spawnTimer <= 0) {
      this.spawnTimer = 0.06;
      const burst = this.peds.length < max * 0.6 ? 3 : 1;
      for (let i = 0; i < burst; i++) this.spawnNear(pl, game, ring);
    }
  }

  /**
   * Uomini di guardia dentro un territorio vicino. Non usano i marciapiedi (in un
   * piazzale non ce ne sono) e non passano dagli isolati: stanno nel rettangolo
   * della banda e basta.
   */
  spawnTurf(pl, game, ring) {
    const rng = this.rng;
    for (const t of this.city.turfs || []) {
      const d = dist(t.cx, t.cy, pl.x, pl.y);
      if (d > ring.max || d < ring.min) continue;
      let here = 0;
      for (const p of this.peds) if (p.turf === t) here++;
      if (here >= 4) continue;
      const x = t.x + 14 + rng.range(0, Math.max(1, t.w - 28));
      const y = t.y + 14 + rng.range(0, Math.max(1, t.h - 28));
      // Un territorio è piccolo e si guarda da fuori: pretendere che nasca *fuori
      // campo* come i passanti significa non vederci mai nessuno. Basta che non
      // compaia addosso al giocatore, e i suoi uomini ci sono già quando arrivi.
      if (dist(x, y, pl.x, pl.y) < 300) continue;
      const ped = createPed('gangster', x, y, rng);
      ped.turf = t;
      ped.gang = t.gang;
      ped.armed = rng.chance(0.7); // in casa propria sono armati quasi tutti
      ped.state = 'guard';
      // Chi fa il 거래책 lo decide `refreshDealer` al prossimo frame, e lo decide
      // da solo: due punti che scrivono lo stesso flag lasciavano in giro un
      // secondo uomo marchiato come contatto, e il giocatore andava a parlare con
      // quello sbagliato.
      this.peds.push(ped);
      return ped;
    }
    return null;
  }

  spawnNear(pl, game, ring = ringFor(game)) {
    const rng = this.rng;
    // Prima i territori: sono pochi e vanno riempiti, altrimenti si arriva in un
    // piazzale con il tag dipinto a terra e nessuno a difenderlo.
    if (rng.chance(0.35)) {
      const g = this.spawnTurf(pl, game, ring);
      if (g) return g;
    }
    const r = ring.max;
    const blocks = this.city.blockGrid.queryRect(pl.x - r, pl.y - r, r * 2, r * 2);
    if (!blocks.length) return null;
    for (let attempt = 0; attempt < 20; attempt++) {
      const block = rng.pick(blocks);
      if (!block || (block.type === 'dock' && rng.chance(0.6))) continue;
      const side = rng.int(0, 3);
      const t = rng.next();
      const pt = sidewalkPoint(block, side, t, {});
      const d = dist(pt.x, pt.y, pl.x, pl.y);
      if (d > ring.max || d < ring.min) continue;
      if (!ring.allowVisible && !outsideView(game, pt.x, pt.y, 40)) continue;
      // Mai far comparire un pedone sotto le ruote di qualcuno.
      if (game.vehicleGrid) {
        const cars = game.vehicleGrid.queryCircle(pt.x, pt.y, 46);
        if (cars.some((v) => !v.spot)) continue;
      }
      const district = DISTRICT_BY_ID[block.district] || DISTRICT_BY_ID.hongdae;
      const ped = createPed(rng.pick(district.pedMix), pt.x, pt.y, rng);
      ped.block = block;
      ped.side = side;
      ped.t = t;
      if (rng.chance(0.12)) {
        ped.state = 'idle';
        ped.idleT = rng.range(2, 9);
      }
      this.peds.push(ped);
      return ped;
    }
    return null;
  }

  updatePed(p, dt, game) {
    if (p.dead) {
      // Ragdoll povero ma efficace: scivola, gira su se stesso e lascia la scia.
      p.vx = damp(p.vx, 0, 0.12, dt);
      p.vy = damp(p.vy, 0, 0.12, dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;
      p.spin = damp(p.spin, 0, 0.1, dt);
      if (p.deadT < 0.8 && Math.random() < 0.3) game.fx.addBlood(p.x, p.y, 0.5);
      return;
    }
    if (p.bleedT > 0) {
      p.bleedT -= dt;
      if (Math.random() < 0.25) game.fx.addBlood(p.x, p.y, 0.25);
    }

    // Pericolo: veicoli veloci nei paraggi
    const threats = game.vehicleGrid.queryCircle(p.x, p.y, 130);
    for (const v of threats) {
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 70) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy);
      // Solo se il veicolo sta puntando verso il pedone
      const towards = (v.vx * dx + v.vy * dy) / (sp * (d || 1));
      if (d < 120 && towards > 0.55) {
        p.panic = Math.max(p.panic, 2.4);
        p.fleeFromX = v.x;
        p.fleeFromY = v.y;
      }
      // Investimento
      if (d < 22 && sp > 85) this.knockDown(p, v, game);
    }
    // Chi è in servizio non scappa dalle auto: se scappasse, il primo inseguimento
    // in mezzo al traffico scioglierebbe la pattuglia.
    if (p.cop) p.panic = 0;

    if (p.panic > 0 && !p.hostile) {
      p.panic -= dt;
      p.state = p.panic > 0 ? 'flee' : 'walk';
    }

    // Una guardia che ha finito di correre o di sparare torna al recinto. Senza,
    // qualunque spavento la promuove a passante per sempre: e siccome dai 철마파
    // ci si arriva **guidando**, e un'auto che accosta fa scappare chi ha intorno,
    // il 거래책 spariva proprio nel momento in cui serviva.
    // Non basta guardare se è ancora dentro il recinto: fuggendo a 2,1× per due
    // secondi ne esce di trecento pixel, e da `walk` non ci tornerebbe mai più.
    // È lo stato `guard` a riportarcelo, camminando.
    if (p.turf && !p.hostile && p.panic <= 0 && (p.state === 'walk' || p.state === 'idle')) {
      p.state = 'guard';
    }

    // Il riparo è uno stato di riposo, non una gabbia: panico, ostilità e
    // servizio riscrivono `state` da soli e portano fuori dal portone senza che
    // qui serva un caso apposta.
    const rain = game.dayCycle.rain;
    if (p.shelterCd > 0) p.shelterCd -= dt;
    if (rain > RAIN_SHELTER && p.shy && p.umbrella < 0 && p.shelterCd <= 0
      && (p.state === 'walk' || p.state === 'idle')) {
      this.seekShelter(p, game);
    }

    let targetSpeed = p.baseSpeed;
    let tx = p.x, ty = p.y;

    switch (p.state) {
      case 'idle': {
        p.idleT -= dt;
        targetSpeed = 0;
        if (p.idleT <= 0) p.state = 'walk';
        break;
      }
      case 'flee': {
        targetSpeed = p.baseSpeed * 2.1;
        const dx = p.x - (p.fleeFromX ?? p.x);
        const dy = p.y - (p.fleeFromY ?? p.y);
        const l = Math.hypot(dx, dy) || 1;
        tx = p.x + (dx / l) * 90;
        ty = p.y + (dy / l) * 90;
        break;
      }
      case 'hostile': {
        const pl = game.player;
        const d = dist(p.x, p.y, pl.x, pl.y);
        const aim = Math.atan2(pl.y - p.y, pl.x - p.x);
        p.fireT -= dt;
        // Chi si è messo al riparo dentro un'auto, o è già lontano, non vale la pena.
        if (!pl.onFoot || pl.dying || d > 900) {
          p.hostile = false;
          p.state = 'walk';
          p.panic = 2;
          break;
        }
        if (p.armed) {
          // Tiene la distanza di tiro, ma solo se un tiro ce l'ha: con un muro in
          // mezzo si sbriga a girarci intorno invece di restare lì a mirare il nulla.
          const los = hasLineOfSight(game, p.x, p.y, pl.x, pl.y);
          const hold = los && d < 130;
          targetSpeed = p.baseSpeed * (!los || d > GUN_RANGE ? 1.7 : hold ? 1.1 : 0.3);
          const reach = hold ? -110 : 110;
          tx = p.x + Math.cos(aim) * reach;
          ty = p.y + Math.sin(aim) * reach;
          if (los && d < GUN_RANGE && p.fireT <= 0) {
            p.fireT = 0.5 + Math.random() * 0.8;
            p.angle = aim;
            shoot(game, p, WEAPONS.pistol, p.x + Math.cos(aim) * 13, p.y + Math.sin(aim) * 13, aim, { spreadMul: 2.8 });
          }
        } else {
          targetSpeed = p.baseSpeed * 1.9;
          tx = pl.x;
          ty = pl.y;
          if (d < FIST_RANGE + 12 && p.fireT <= 0) {
            p.fireT = WEAPONS.fists.rate * 2.4;
            p.angle = aim;
            meleeSwing(game, p, WEAPONS.fists, p.x, p.y, aim);
          }
        }
        break;
      }
      case 'shelter': {
        p.shelterT -= dt;
        // Smesso di piovere non si riparte tutti insieme: la fine della pioggia
        // diventa un conto alla rovescia diverso per ognuno, e sotto la tettoia
        // resta chi ci sta ancora bene.
        if (rain < p.rainOut && p.shelterT > 6) p.shelterT = 1 + this.rng.range(0, 5);
        if (p.shelterT <= 0) {
          p.state = 'walk';
          p.shelterCd = 4 + this.rng.range(0, 8);
          break;
        }
        tx = p.shelterX;
        ty = p.shelterY;
        if (dist(p.x, p.y, tx, ty) < 9) {
          targetSpeed = 0;
          // Da fermi si guarda la strada, non il muro: è quello che rende
          // leggibile dall'alto una fila di gente sotto una tettoia.
          p.angle = approachAngle(p.angle, p.shelterA, 3 * dt);
        } else {
          targetSpeed = p.baseSpeed * 1.35;   // gli ultimi metri si fanno di corsa
        }
        break;
      }
      case 'guard': {
        // Presidio: si gira dentro il proprio recinto e non ne esce. Uscire
        // vorrebbe dire pathfinding e marciapiedi, e un tizio che ciondola
        // davanti a un magazzino non ha bisogno né dell'uno né degli altri.
        const t = p.turf;
        if (!t) { p.state = 'walk'; break; }
        if (p.idleT > 0) {
          p.idleT -= dt;
          targetSpeed = 0;
          break;
        }
        // Il 거래책 non fa il giro del recinto: sta dove tratta. Un contatto che
        // ciondola trasforma i 54 px del banco in un inseguimento con `E` in mano,
        // ed è anche il modo in cui si capisce chi comanda in un cortile.
        if (p.dealer) {
          if (!p.postX) { p.postX = p.x; p.postY = p.y; }
          tx = p.postX;
          ty = p.postY;
          targetSpeed = dist(p.x, p.y, tx, ty) > 8 ? p.baseSpeed * 0.5 : 0;
          break;
        }
        targetSpeed = p.baseSpeed * 0.55;
        if (!p.postX || dist(p.x, p.y, p.postX, p.postY) < 22) {
          p.postX = t.x + 18 + Math.random() * Math.max(1, t.w - 36);
          p.postY = t.y + 18 + Math.random() * Math.max(1, t.h - 36);
          if (Math.random() < 0.45) p.idleT = 1.5 + Math.random() * 4;
        }
        tx = p.postX;
        ty = p.postY;
        break;
      }
      case 'duty': {
        // Poliziotto in servizio: dove andare lo decide `police.copBehavior`, il
        // come muoversi resta il codice di steering condiviso qui sotto.
        const order = game.police ? game.police.copBehavior(p, dt, game) : null;
        if (order) {
          tx = order.x;
          ty = order.y;
          targetSpeed = order.speed;
        }
        if (!p.cop) p.state = 'walk';
        break;
      }
      case 'crossing': {
        targetSpeed = p.baseSpeed * 1.45;
        tx = p.crossX;
        ty = p.crossY;
        if (dist(p.x, p.y, tx, ty) < 12) {
          // Si aggancia al marciapiede dell'isolato raggiunto
          const near = this.city.blockGrid.queryRect(p.x - 40, p.y - 40, 80, 80);
          let best = null, bd = Infinity;
          for (const b of near) {
            const cx = clamp(p.x, b.x, b.x + b.w);
            const cy = clamp(p.y, b.y, b.y + b.h);
            const d = dist(p.x, p.y, cx, cy);
            if (d < bd) { bd = d; best = b; }
          }
          if (best) {
            p.block = best;
            const side = this.nearestSide(best, p.x, p.y);
            p.side = side;
            p.t = this.tOnSide(best, side, p.x, p.y);
            p.state = 'walk';
          } else {
            p.state = 'walk';
          }
        }
        break;
      }
      default: {
        if (!p.block) {
          const near = this.city.blockGrid.queryRect(p.x - 200, p.y - 200, 400, 400);
          if (near.length) {
            p.block = near[0];
            p.side = this.nearestSide(p.block, p.x, p.y);
            p.t = this.tOnSide(p.block, p.side, p.x, p.y);
          }
          break;
        }
        const len = sideLength(p.block, p.side);
        p.t += (p.dirSign * targetSpeed * dt) / Math.max(1, len);
        if (p.t > 1 || p.t < 0) {
          // Angolo dell'isolato: gira, oppure attraversa la strada
          const wantCross = this.rng.chance(0.16);
          if (wantCross && this.crossingIsSafe(p, game)) {
            this.startCrossing(p);
          } else {
            const turn = p.t > 1 ? 1 : -1;
            p.side = (p.side + (p.dirSign > 0 ? turn : turn) + 4) % 4;
            p.t = p.t > 1 ? 0.02 : 0.98;
            if (this.rng.chance(0.18)) p.dirSign *= -1;
          }
        }
        p.t = clamp(p.t, 0, 1);
        const pt = sidewalkPoint(p.block, p.side, p.t, this.tmp);
        tx = pt.x;
        ty = pt.y;
        if (this.rng.chance(0.0016)) {
          p.state = 'idle';
          p.idleT = this.rng.range(1.5, 6);
        }
        break;
      }
    }

    // Sotto l'acqua si allunga il passo, ombrello o no: è il modo più economico
    // di far vedere che piove su chi non si ripara. Chi scappa o è in servizio ha
    // già una sua andatura e non c'entra niente con il tempo.
    if (rain > 0.05 && (p.state === 'walk' || p.state === 'crossing' || p.state === 'shelter')) {
      targetSpeed *= 1 + rain * RAIN_HURRY;
    }

    // Steering verso il punto obiettivo
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5 && targetSpeed > 1) {
      // Stessa pendenza dei veicoli, molto più leggera: in salita si arranca.
      const el = this.city.elevationAt;
      if (el) {
        const slope = (el(tx, ty) - el(p.x, p.y)) / d;
        targetSpeed *= clamp(1 - slope * 3.2, 0.62, 1.3);
      }
      const nvx = (dx / d) * targetSpeed;
      const nvy = (dy / d) * targetSpeed;
      p.vx = damp(p.vx, nvx, 0.07, dt);
      p.vy = damp(p.vy, nvy, 0.07, dt);
    } else {
      p.vx = damp(p.vx, 0, 0.08, dt);
      p.vy = damp(p.vy, 0, 0.08, dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 4) {
      p.angle = approachAngle(p.angle, Math.atan2(p.vy, p.vx), 10 * dt);
      p.animT += sp * dt * 0.2;
    }

    // Non attraversano i muri. I solidi `vehicleOnly` (le scalinate) sì: sono
    // fatti apposta per lasciar passare chi va a piedi.
    // Chi è già arrivato sotto la tettoia è fermo contro un muro che ha già
    // scavalcato: rifargli la query dei solidi a ogni frame, per venti persone,
    // è il grosso di quello che costa la pioggia.
    if (p.state === 'flee' || p.state === 'crossing' || p.state === 'hostile'
      || p.state === 'duty' || (p.state === 'shelter' && targetSpeed > 0)) {
      const solids = this.city.solidGrid.queryRect(p.x - 24, p.y - 24, 48, 48);
      for (const s of solids) {
        if (s.vehicleOnly) continue;
        const push = circleRectPush(p.x, p.y, 7, s);
        if (!push) continue;
        p.x += push.nx * push.depth;
        p.y += push.ny * push.depth;
      }
    }
  }

  /**
   * Cerca il portone più vicino e ci si mette sotto. I portoni sono punti che
   * esistono già (`b.shop`), quindi non serve un indice nuovo: bastano gli
   * edifici attorno. La ricerca è dietro a `shelterCd` perché una query di
   * 680×680 px per pedone per frame, sotto la pioggia, si paga.
   */
  seekShelter(p, game) {
    p.shelterCd = 2 + this.rng.range(0, 3);
    const R = SHELTER_REACH;
    let best = null;
    let bd = R * R;
    for (const b of this.city.buildingGrid.queryRect(p.x - R, p.y - R, R * 2, R * 2, this._sq)) {
      if (!b.shop) continue;
      const d2 = (b.shop.x - p.x) ** 2 + (b.shop.y - p.y) ** 2;
      if (d2 < bd) { bd = d2; best = b.shop; }
    }
    if (!best) return;
    // Sotto la tettoia, non sullo zerbino: un filo più in fuori della soglia (o
    // si finisce dentro il muro) e spostati di lato, o cinque persone allo stesso
    // portone stanno tutte nello stesso pixel.
    const off = ((p.id % 5) - 2) * 11;
    p.shelterX = best.x + best.nx * 6 - best.ny * off;
    p.shelterY = best.y + best.ny * 6 + best.nx * off;
    p.shelterA = Math.atan2(best.ny, best.nx);
    p.shelterT = SHELTER_MAX;
    p.state = 'shelter';
  }

  /**
   * Danno a un pedone. `dx,dy` è la direzione del colpo: decide lo schizzo e la
   * spinta. Chi sa reagire (teppisti, poliziotti) si volta contro il giocatore,
   * tutti gli altri scappano.
   */
  hurt(p, dmg, dx, dy, game, source, knock = 0) {
    if (p.dead) return;
    p.hp -= dmg;
    game.fx.addBloodSpray(p.x, p.y, dx, dy, clamp(dmg / 30, 0.4, 1.5));
    p.vx += dx * (knock || 45);
    p.vy += dy * (knock || 45);
    if (p.hp <= 0) {
      this.kill(p, dx, dy, game, source);
      return;
    }
    p.bleedT = 0.4;
    game.audio?.hurt(p.x, p.y, false);
    if (p.cop) {
      // Un agente ferito non scappa e non cambia stato: resta in servizio, e la
      // centrale se lo segna.
      if (source === game.player) game.wanted?.report('copHit', game);
      return;
    }
    if (source === game.player && PED_KINDS[p.kind]?.fights) {
      p.hostile = true;
      p.state = 'hostile';
      p.panic = 0;
    } else {
      p.panic = Math.max(p.panic, 5);
      p.fleeFromX = p.x - dx * 90;
      p.fleeFromY = p.y - dy * 90;
      p.state = 'flee';
    }
  }

  kill(p, dx, dy, game, source) {
    p.dead = true;
    p.deadT = 0;
    p.hostile = false;
    p.vx += dx * 95;
    p.vy += dy * 95;
    p.spin = (Math.random() - 0.5) * 9;
    game.fx.addBlood(p.x, p.y, 1.3);
    game.onPedKilled?.(p, null, Math.hypot(p.vx, p.vy), source);
  }

  /**
   * Uno sparo (o una rissa) si sente: chi è nel raggio scappa. I teppisti che
   * sono vicini al giocatore, invece, se la legano al dito.
   */
  alarm(x, y, r, game, source) {
    const r2 = r * r;
    const near2 = (r * 0.55) ** 2;
    // Un grido solo per allarme: la folla che urla tutta insieme diventa rumore
    // bianco, e il tetto delle voci lo taglierebbe comunque a caso.
    let voiced = Math.random() > 0.55;
    for (const p of this.peds) {
      if (p.dead || p.hostile || p.cop) continue;
      const d2 = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d2 > r2) continue;
      if (source === game.player && PED_KINDS[p.kind]?.fights && d2 < near2) {
        p.hostile = true;
        p.state = 'hostile';
        continue;
      }
      p.panic = Math.max(p.panic, 3.5);
      p.fleeFromX = x;
      p.fleeFromY = y;
      p.state = 'flee';
      if (!voiced) {
        voiced = true;
        game.audio?.scream(p.x, p.y);
      }
    }
  }

  nearestSide(b, x, y) {
    const dTop = Math.abs(y - b.y);
    const dBottom = Math.abs(b.y + b.h - y);
    const dLeft = Math.abs(x - b.x);
    const dRight = Math.abs(b.x + b.w - x);
    const min = Math.min(dTop, dBottom, dLeft, dRight);
    if (min === dTop) return 0;
    if (min === dRight) return 1;
    if (min === dBottom) return 2;
    return 3;
  }

  tOnSide(b, side, x, y) {
    if (side === 0 || side === 2) return clamp((x - b.x) / b.w, 0, 1);
    return clamp((y - b.y) / b.h, 0, 1);
  }

  /** Guarda se arriva qualcuno prima di scendere dal marciapiede. */
  crossingIsSafe(p, game) {
    if (!game.vehicleGrid) return true;
    const near = game.vehicleGrid.queryCircle(p.x, p.y, 190);
    for (const v of near) {
      const sp = Math.hypot(v.vx, v.vy);
      if (sp < 45) continue;
      const dx = p.x - v.x;
      const dy = p.y - v.y;
      const d = Math.hypot(dx, dy) || 1;
      // Il veicolo si sta avvicinando frontalmente al pedone?
      if ((v.vx * dx + v.vy * dy) / (sp * d) > 0.6 && d < 60 + sp * 0.9) return false;
    }
    return true;
  }

  /** Attraversamento: punta al marciapiede oltre la carreggiata. */
  startCrossing(p) {
    const b = p.block;
    const pt = sidewalkPoint(b, p.side, clamp(p.t, 0, 1), {});
    let nx = 0, ny = 0;
    if (p.side === 0) ny = -1;
    else if (p.side === 1) nx = 1;
    else if (p.side === 2) ny = 1;
    else nx = -1;
    const reach = 110;
    p.crossX = pt.x + nx * reach;
    p.crossY = pt.y + ny * reach;
    p.state = 'crossing';
    p.t = clamp(p.t, 0.02, 0.98);
  }

  knockDown(p, v, game) {
    if (p.dead) return;
    p.dead = true;
    p.deadT = 0;
    const sp = Math.hypot(v.vx, v.vy);
    p.vx = v.vx * 0.85 + (Math.random() - 0.5) * 40;
    p.vy = v.vy * 0.85 + (Math.random() - 0.5) * 40;
    p.spin = (Math.random() - 0.5) * 11;
    game.onPedKilled?.(p, v, sp, v.driver === 'player' ? game.player : null);
  }
}
