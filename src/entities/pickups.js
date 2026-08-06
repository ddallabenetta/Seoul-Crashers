// Raccolte a terra: armi, munizioni e kit medici nei cortili, nei vicoli e nei
// piazzali dei moli, più — molto più rade — le capezzagne dei campi e le teste
// dei moli del porto (`placeRural`). Si riformano dopo un po' invece di sparire
// per sempre.
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

// Fuori città si trova altra roba, e non è un dettaglio di colore: una minigun in
// un'aia non si spiega, una pompa da caccia in un fienile sì. Le due tabelle di
// campagna sono anche il modo più corto di dire che la Seoul rurale non è la
// versione vuota di quella urbana, è un posto diverso.
// Il fucile d'assalto è il premio più grosso che si trova qui, e ci sta: dalla
// campagna il pezzo pesante è quello che passa il confine, non quello che compra
// un cecchino. Il 저격총 e la minigun restano roba di città e di porto — anche
// perché la ricettazione le ripaga bene, e le raccolte si riformano.
const RURAL_TABLE = [
  'health', 'health', 'ammo', 'ammo', 'ammo',
  'shotgun', 'shotgun', 'shotgun', 'rifle', 'rifle', 'bat', 'molotov',
];

// Sui moli passa quello che arriva dentro un container: esplosivi e armi corte,
// e ogni tanto qualcosa che in un negozio non si vende affatto.
const PIER_TABLE = [
  'health', 'ammo', 'ammo', 'pistol', 'smg', 'smg', 'shotgun',
  'grenade', 'mine', 'molotov', 'minigun',
];

export class PickupSystem {
  constructor(city, rng) {
    this.city = city;
    this.items = [];
    this.grid = new SpatialGrid(city.w, city.h, 300);
    this._q = [];
    this.place(rng);
  }

  /**
   * Un borsone dentro un muro non lo raccoglie nessuno: si vede spuntare da sotto
   * un silo e non c'è modo di arrivarci. In città non capita — i cortili sono
   * vuoti per costruzione — ma in campagna il bordo di un campo passa sotto una
   * serra e sotto un fienile.
   */
  freeSpot(x, y) {
    for (const s of this.city.solidGrid.queryCircle(x, y, 14)) {
      if (x > s.x - 6 && x < s.x + s.w + 6 && y > s.y - 6 && y < s.y + s.h + 6) return false;
    }
    return true;
  }

  /**
   * Come `add`, ma per le raccolte che **devono** esserci: se il punto scelto è
   * murato si cerca attorno invece di rinunciare. Serve alle tre davanti alla
   * safehouse — la molotov cadeva dentro l'angolo di un palazzo, ed è rimasta
   * irraggiungibile per tre fasi di sviluppo senza che se ne accorgesse nessuno.
   */
  addNear(kind, x, y) {
    if (this.freeSpot(x, y)) return this.add(kind, x, y);
    for (let r = 24; r <= 96; r += 24) {
      for (let a = 0; a < 8; a++) {
        const px = x + Math.cos((a / 8) * 6.2832) * r;
        const py = y + Math.sin((a / 8) * 6.2832) * r;
        if (this.freeSpot(px, py)) return this.add(kind, px, py);
      }
    }
    return this.add(kind, x, y);
  }

  /**
   * Tutto di nuovo per terra. Le raccolte non entrano nel salvataggio — che
   * ricompaiano da sole è già il loro comportamento normale — ma caricare una
   * partita non deve lasciare vuoti i cortili svuotati in quella precedente.
   */
  reset() {
    for (const it of this.items) {
      it.taken = false;
      it.t = 0;
    }
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
        const kind = rng.pick(TABLE);
        const px = y.x + y.w * rng.range(0.25, 0.75);
        const py = y.y + y.h * rng.range(0.25, 0.75);
        // L'rng si pesca comunque, anche quando il punto viene scartato: il
        // sorteggio dei cortili deve restare quello collaudato.
        if (this.freeSpot(px, py)) this.add(kind, px, py);
      }
    }
    // Tre certe davanti alla safehouse: la prima prova non deve dipendere dalla
    // fortuna, e la molotov è il modo più rapido di vedere cosa fa la tappa C.
    const s = this.city.spawn;
    this.addNear('bat', s.x + 44, s.y + 26);
    this.addNear('ammo', s.x + 20, s.y + 58);
    this.addNear('molotov', s.x + 62, s.y + 58);
    // In coda, e non dentro il giro qui sopra: così le raccolte urbane restano
    // esattamente quelle di prima anche adesso che l'rng viene pescato di più.
    this.placeRural(rng);
  }

  /**
   * Campagna e moli. **La densità è molto più bassa che in città**, e non per
   * pigrizia: la campagna è vuota per progetto, e un self-service fra le risaie
   * toglierebbe l'unica cosa che ha — che ci si va apposta. In città si pesca su
   * un cortile su due e un cortile è largo cento passi; qui si pesca su un campo
   * su tre e un campo ne è largo duecentocinquanta, cioè **un ordine di grandezza
   * meno per metro quadro**.
   *
   * I punti non sono nuovi: sono la capezzagna di un campo (`block.fields`, il
   * bordo dove passa il trattore, non il mezzo della risaia) e la testa di un molo
   * (`city.piers`), che è anche l'unico premio per chi arriva fin lì in barca.
   */
  placeRural(rng) {
    for (const b of this.city.blocks) {
      if (b.type !== 'rural' || !b.fields) continue;
      for (const f of b.fields) {
        if (f.w < 70 || f.h < 70) continue;
        if (!rng.chance(0.32)) continue;
        // Sul bordo, non in mezzo: dentro una risaia allagata un borsone
        // galleggerebbe, e il giocatore ci arriva camminando lungo il fosso.
        const edge = rng.chance(0.5);
        const x = f.x + (edge ? f.w * rng.range(0.1, 0.9) : rng.chance(0.5) ? 8 : f.w - 8);
        const y = f.y + (edge ? (rng.chance(0.5) ? 8 : f.h - 8) : f.h * rng.range(0.1, 0.9));
        if (this.freeSpot(x, y)) this.add(rng.pick(RURAL_TABLE), x, y);
      }
    }
    for (const p of this.city.piers || []) {
      // I moli del porto sono una meta — ci si arriva apposta, in barca o facendo
      // tutto il lungomare — e rendono quasi sempre; gli scali sul Han sono sulla
      // strada di tutti e rendono di rado, o diventerebbero una fila di distributori.
      if (!rng.chance(p.river ? 0.3 : 0.85)) continue;
      // Verso il largo: la testa del molo è il punto più lontano dalla banchina,
      // ed è là che si scarica quello che non passa dalla dogana.
      const t = p.river ? 0.5 : rng.range(0.08, 0.28);
      const x = p.x + p.w * t;
      const y = p.y + p.h / 2;
      if (this.freeSpot(x, y)) this.add(rng.pick(PIER_TABLE), x, y);
    }
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
      game.audio?.pickup('heal');
      return true;
    }
    if (s.weapon) {
      pl.giveWeapon(s.weapon, s.ammo || 0);
      game.hud.toast(s.ammo ? `${s.label} · ${s.ammo} colpi` : s.label, 1.6);
      game.audio?.pickup('weapon');
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
        game.audio?.pickup('ammo');
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
