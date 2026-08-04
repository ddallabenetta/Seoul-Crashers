// Raccolte a terra: armi, munizioni e kit medici nei cortili, nei vicoli e nei
// piazzali dei moli. Senza negozi (fase 3) è l'unico modo di rifornirsi, quindi
// si riformano dopo un po' invece di sparire per sempre.
import { SpatialGrid } from '../core/spatial.js';
import { WEAPONS, WEAPON_ORDER } from './weapons.js';

const RESPAWN = 55;
const REACH = 26;

export const PICKUP_KINDS = {
  bat:     { kind: 'bat', weapon: 'bat', label: 'mazza', color: '#c9a24a' },
  katana:  { kind: 'katana', weapon: 'katana', label: 'katana', color: '#dfe6ef' },
  pistol:  { kind: 'pistol', weapon: 'pistol', ammo: 34, label: 'pistola', color: '#8fb6e8' },
  shotgun: { kind: 'shotgun', weapon: 'shotgun', ammo: 14, label: 'pompa', color: '#e8785a' },
  smg:     { kind: 'smg', weapon: 'smg', ammo: 90, label: 'SMG', color: '#e8a04a' },
  rifle:   { kind: 'rifle', weapon: 'rifle', ammo: 75, label: 'fucile d\'assalto', color: '#a0e85a' },
  sniper:  { kind: 'sniper', weapon: 'sniper', ammo: 8, label: 'fucile di precisione', color: '#5ad2e8' },
  minigun: { kind: 'minigun', weapon: 'minigun', ammo: 180, label: 'minigun', color: '#ffd23f' },
  molotov: { kind: 'molotov', weapon: 'molotov', ammo: 5, label: 'molotov', color: '#ff7a2f' },
  grenade: { kind: 'grenade', weapon: 'grenade', ammo: 5, label: 'granate', color: '#8fbf6a' },
  mine:    { kind: 'mine', weapon: 'mine', ammo: 3, label: 'mine', color: '#c33a33' },
  ammo:    { kind: 'ammo', label: 'munizioni', color: '#c9a24a' },
  health:  { kind: 'health', heal: 45, label: 'kit medico', color: '#e8595e' },
};

// Distribuzione: i kit medici sono comuni, l'arsenale pesante è raro e il fucile di
// precisione e la minigun compaiono una volta ogni tanto — un cortile su ~42.
// L'estrazione è `rng.pick`, cioè **una sola** chiamata all'rng: allungare o
// riordinare questa tabella cambia quali armi escono ma non sposta niente altro
// nel mondo (vedi HANDOFF, determinismo).
const TABLE = [
  'health', 'health', 'health', 'ammo', 'ammo', 'ammo', 'ammo',
  'pistol', 'pistol', 'bat', 'smg', 'smg', 'shotgun', 'shotgun',
  'molotov', 'molotov', 'grenade', 'katana', 'rifle', 'mine', 'sniper', 'minigun',
];

export class PickupSystem {
  constructor(city, rng) {
    this.city = city;
    this.items = [];
    this.grid = new SpatialGrid(city.w, city.h, 300);
    this._q = [];
    this.place(rng);
  }

  add(kind, x, y) {
    const item = { spec: PICKUP_KINDS[kind], x, y, taken: false, t: 0 };
    this.items.push(item);
    this.grid.insertRect({ x: x - 16, y: y - 16, w: 32, h: 32, item });
    return item;
  }

  /** Un borsone ogni tanto nei cortili chiusi: sono i posti dove non passa nessuno. */
  place(rng) {
    for (const b of this.city.blocks) {
      for (const y of b.yards) {
        if (y.stairs || y.w < 44 || y.h < 44) continue;
        if (!rng.chance(0.4)) continue;
        this.add(
          rng.pick(TABLE),
          y.x + y.w * rng.range(0.25, 0.75),
          y.y + y.h * rng.range(0.25, 0.75)
        );
      }
    }
    // Tre certe davanti alla safehouse: la prima prova non deve dipendere dalla
    // fortuna, e la molotov è il modo più rapido di vedere cosa fa la tappa C.
    const s = this.city.spawn;
    this.add('bat', s.x + 44, s.y + 26);
    this.add('ammo', s.x + 20, s.y + 58);
    this.add('molotov', s.x + 62, s.y + 58);
  }

  update(dt, game) {
    const pl = game.player;
    for (const hit of this.grid.queryCircle(pl.x, pl.y, 240, this._q)) {
      const it = hit.item;
      if (it.taken) continue;
      if (!pl.onFoot || pl.dying) continue;
      if ((pl.x - it.x) ** 2 + (pl.y - it.y) ** 2 > REACH * REACH) continue;
      if (this.collect(it, game)) {
        it.taken = true;
        it.t = RESPAWN;
      }
    }
    for (const it of this.items) {
      if (!it.taken) continue;
      it.t -= dt;
      if (it.t <= 0) it.taken = false;
    }
  }

  collect(it, game) {
    const pl = game.player;
    const s = it.spec;
    if (s.heal) {
      if (pl.hp >= pl.maxHp) return false;
      pl.heal(s.heal);
      game.hud.toast(`${s.label} +${s.heal}`, 1.4);
      return true;
    }
    if (s.weapon) {
      pl.giveWeapon(s.weapon, s.ammo || 0);
      game.hud.toast(s.ammo ? `${s.label} · ${s.ammo} colpi` : s.label, 1.6);
      return true;
    }
    // Cassa di munizioni: rifornisce l'arma in mano, o la prima che ne ha bisogno.
    // Gli esplosivi restano fuori: una cassa che ricarica granate sarebbe una
    // fabbrica di granate, e i cortili sono 42.
    const order = [pl.weapon, ...WEAPON_ORDER];
    for (const id of order) {
      const spec = WEAPONS[id];
      if (!spec || spec.infinite || spec.thrown) continue;
      if (pl.giveAmmo(id, Math.round(spec.maxAmmo * 0.28))) {
        game.hud.toast(`munizioni ${spec.label}`, 1.4);
        return true;
      }
    }
    return false;
  }

  /** Raccolte visibili nel rettangolo dato, per il pass di rendering. */
  visible(view, out = []) {
    out.length = 0;
    for (const hit of this.grid.queryRect(view.x, view.y, view.w, view.h, this._q)) {
      if (!hit.item.taken) out.push(hit.item);
    }
    return out;
  }
}
