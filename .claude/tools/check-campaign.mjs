#!/usr/bin/env node
// Check puro della campagna: gira senza DOM, rete o browser e difende la catena,
// il grafo stradale e le tre condizioni del finale nascosto.
import assert from 'node:assert/strict';
import { createRegion } from '../../src/world/regions.js';
import { CAMPAGNA, DOPO } from '../../src/story/campaign.js';
import { shortestRoadPath } from '../../src/core/navigation.js';
import { KKACHI_CALLS, KkachiSystem } from '../../src/core/kkachi.js';
import { canFinalC } from '../../src/story/finals.js';
import { ShopSystem, gangStock } from '../../src/entities/shops.js';

assert.deepEqual(CAMPAGNA.map((m) => m.id),
  Array.from({ length: 12 }, (_, i) => `m${i + 1}`));
assert.equal(Object.keys(DOPO).length, 11);
for (let i = 1; i < 12; i++) assert.equal(DOPO[`m${i}`], `m${i + 1}`);
for (const mission of CAMPAGNA) {
  assert.ok(mission.title && mission.hangul && mission.phases.length,
    `${mission.id}: definizione incompleta`);
  assert.equal(new Set(mission.phases.map((p) => p.id)).size, mission.phases.length,
    `${mission.id}: id di fase duplicato`);
}

assert.equal(KKACHI_CALLS.length, 24);
assert.equal(new Set(KKACHI_CALLS.map((c) => c.id)).size, 24);
const kkachi = new KkachiSystem();
for (let i = 1; i <= 20; i++) kkachi.heard.add(i);
const flags = new Set(['jo_lighter', 'dulchae_alive']);
const finaleGame = {
  kkachi,
  missions: { flag: (name) => flags.has(name), state: {} },
  actors: { isDead: () => false, defs: new Map() },
};
assert.equal(canFinalC(finaleGame), true);
flags.add('dulchae_dead');
assert.equal(canFinalC(finaleGame), false);

function radioGame() {
  const events = [];
  return {
    radio: { isKkachi: true },
    player: { onFoot: false, vehicle: { hp: 100 }, owned: new Set(), money: 60_000, district: {} },
    metro: { inside: false }, wanted: { level: 0 }, indoors: false, paused: false,
    dayCycle: { hour: 3, rain: 0, isNight: true },
    stats: { deaths: 0, stolen: 0, districts: new Set() },
    shops: { sealed: new Set() }, cutscene: { active: false },
    missions: { isDone: () => false, setFlag: () => {}, active: null },
    hud: { toast: () => {} }, emit: (name, id) => events.push([name, id]), events,
    dialogue: {
      active: false, lines: null, onDone: null,
      play(_game, lines, onDone) {
        this.active = true; this.lines = lines.filter(Boolean); this.onDone = onDone;
      },
      cancel() { this.active = false; this.lines = null; this.onDone = null; return true; },
      finish(game) {
        const done = this.onDone; this.active = false; this.lines = null; this.onDone = null;
        done?.(game);
      },
    },
  };
}

const heardSystem = new KkachiSystem();
const heardGame = radioGame();
heardSystem.play(KKACHI_CALLS[5], heardGame);
heardSystem.update(0.1, heardGame);
assert.equal(heardSystem.active, 6);
assert.equal(heardSystem.missed.size, 0);
heardGame.dialogue.finish(heardGame);
assert.deepEqual([...heardSystem.heard], [6]);

const missedSystem = new KkachiSystem();
const missedGame = radioGame();
missedSystem.play(KKACHI_CALLS[5], missedGame);
missedGame.radio.isKkachi = false;
missedSystem.update(0.1, missedGame);
assert.deepEqual([...missedSystem.missed], [6]);
assert.equal(missedGame.dialogue.active, false);

const city = createRegion();
const turf = city.turfs.find((t) => t.gang === 'baekho');
assert.ok(turf, 'serve un cortile 백호파 per il check del commercio');
const shops = new ShopSystem(city);
const turfGame = {
  shops,
  player: { owned: new Set(['fists', 'pistol']), weapon: 'fists', ammo: {}, money: 0,
    giveWeapon() {}, setWeapon() {} },
  emit() {}, hud: { toast() {} }, audio: { ui() {} },
};
const regularPrice = gangStock(turf, turfGame).find((item) => item.price > 0)?.price;
assert.equal(shops.claimTurf(turf, turfGame), true);
const ownedPrice = gangStock(turf, turfGame).find((item) => item.price > 0)?.price;
assert.ok(ownedPrice < regularPrice, 'un cortile posseduto deve applicare lo sconto');
const turfSnapshot = shops.snapshot();
shops.reset();
shops.restore(JSON.parse(JSON.stringify(turfSnapshot)));
assert.equal(shops.ownsTurf(turf), true, 'la proprietà del cortile deve sopravvivere al salvataggio');

const road = city.graph.usableNodes;
const seoul = road.find((n) => city.areaAt(n.x, n.y)?.id === 'seoul');
const busan = road.find((n) => city.areaAt(n.x, n.y)?.id === 'busan');
const jeju = road.find((n) => city.areaAt(n.x, n.y)?.id === 'jeju');
assert.ok(shortestRoadPath(city.graph, seoul, busan)?.length > 2,
  'Seoul e Busan devono essere collegate su strada');
assert.equal(shortestRoadPath(city.graph, seoul, jeju), null,
  'Jeju deve restare una componente stradale separata');

console.log(JSON.stringify({
  missioni: CAMPAGNA.length,
  fasi: CAMPAGNA.reduce((n, m) => n + m.phases.length, 0),
  chiamateKkachi: KKACHI_CALLS.length,
  lifecycleKkachi: true,
  turfPersistente: true,
  rottaSeoulBusan: true,
  finaleC: true,
}));
