// Le schede dei salvataggi. Sta in un file suo perché adesso i posti da cui si
// caricano sono due — il menu di pausa e il menu iniziale (§5.18) — e sono la
// stessa lista con gli stessi tasti: duplicarla vorrebbe dire due liste che
// scivolano l'una dall'altra alla prima modifica.
//
// L'unica differenza fra i due usi è se si può *scrivere*: dal menu iniziale no,
// non c'è ancora una partita da salvare.
import { roundPath } from './hud.js';
import { won } from '../entities/shops.js';
import {
  ALL_SLOTS, AUTO_SLOT, AUTO_GENS, readSlot, writeSlot, clearSlot, describe, apply,
  slotLabel, autosaveOn, toggleAutosave,
} from '../core/save.js';

// Azioni di uno slot. `Salva` vale sempre, le altre due solo su uno slot
// occupato: A/D scelgono la colonna, W/S la riga, Invio conferma.
const ACTIONS = [
  { id: 'save', label: 'Salva' },
  { id: 'load', label: 'Carica' },
  { id: 'wipe', label: 'Cancella' },
];

// Sulla scheda dell'autosave `Salva` era un pulsante spento per definizione — lo
// scrive il gioco — e adesso che l'autosave tiene tre generazioni (§5.21) quel
// posto serve a scorrerle. Stessa lunghezza dell'altra fila: passando da uno
// slot manuale a questo la colonna scelta resta valida.
const AUTO_ACTIONS = [
  { id: 'older', label: 'Precedente' },
  { id: 'load', label: 'Carica' },
  { id: 'wipe', label: 'Cancella' },
];

export class SaveSlots {
  constructor({ canSave = true } = {}) {
    this.canSave = canSave;
    this.slot = 0;
    this.action = canSave ? 0 : 1;
    // Sovrascrivere o cancellare vuole due Invio: uno slot con dentro un'ora di
    // partita non si perde per un tasto premuto per sbaglio.
    this.confirm = -1;
    this.hover = null;
    // Gli slot si leggono all'apertura del pannello e dopo ogni azione, non a
    // ogni frame: `readSlot` fa un `JSON.parse` di qualche kB, e farlo quattro
    // volte per sessanta frame al secondo per disegnare quattro schede ferme è
    // sprecato.
    this.slots = [];
    this.autos = [];   // le generazioni dell'autosave, la 0 è la più recente
    this.gen = 0;      // quella che la scheda `AUTO` sta mostrando
  }

  refresh() {
    this.slots = [];
    for (let i = 0; i < ALL_SLOTS; i++) this.slots.push(readSlot(i));
    this.autos = [];
    for (let g = 0; g < AUTO_GENS; g++) this.autos.push(readSlot(AUTO_SLOT, g));
    if (!this.autos[this.gen]) this.gen = 0;
  }

  /** Quante generazioni dell'autosave esistono davvero. */
  get autoCount() {
    return this.autos.filter(Boolean).length;
  }

  /** Il salvataggio di una scheda: per l'autosave è la generazione mostrata. */
  data(i) {
    return i === AUTO_SLOT ? this.autos[this.gen] : this.slots[i];
  }

  actions(i) {
    return i === AUTO_SLOT ? AUTO_ACTIONS : ACTIONS;
  }

  /** Vero se c'è almeno un salvataggio da riaprire. */
  get any() {
    return this.slots.some(Boolean) || this.autos.some(Boolean);
  }

  /**
   * W/S scelgono lo slot, A/D l'azione, Invio conferma, F accende e spegne
   * l'autosave. Torna `'loaded'` nel frame in cui una partita è stata caricata:
   * chi ospita il pannello ha sempre qualcosa da fare dopo (chiudersi).
   */
  update(game) {
    const input = game.input;
    const audio = game.audio;
    const was = `${this.slot}/${this.action}`;
    if (input.wasPressed('KeyW') || input.wasPressed('ArrowUp')) {
      this.slot = (this.slot - 1 + ALL_SLOTS) % ALL_SLOTS;
    }
    if (input.wasPressed('KeyS') || input.wasPressed('ArrowDown')) {
      this.slot = (this.slot + 1) % ALL_SLOTS;
    }
    const cols = this.actions(this.slot).length;
    if (input.wasPressed('KeyD') || input.wasPressed('ArrowRight')) {
      this.action = (this.action + 1) % cols;
    }
    if (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft')) {
      this.action = (this.action - 1 + cols) % cols;
    }
    if (this.hover && input.mouse.pressed) {
      this.slot = this.hover.slot;
      this.action = this.hover.action;
    }
    if (`${this.slot}/${this.action}` !== was) {
      this.confirm = -1;
      audio?.ui('move');
    }
    if (input.wasPressed('KeyF')) {
      const on = toggleAutosave();
      game.hud.toast(on ? 'Autosave acceso' : 'Autosave sospeso', 2);
      audio?.ui('ok');
    }
    const go = input.wasPressed('Space') || input.wasPressed('Enter')
      || (this.hover && input.mouse.pressed);
    if (!go) return null;
    return this.run(game);
  }

  /** Se un'azione è possibile su uno slot. La scheda `AUTO` la scrive il gioco. */
  enabled(i, action) {
    if (action === 'save') return this.canSave && i !== AUTO_SLOT;
    if (action === 'older') return this.autoCount > 1;
    return !!this.data(i);
  }

  /** Nome di una scheda nei messaggi: l'autosave dice anche quale generazione. */
  label(i) {
    if (i !== AUTO_SLOT || this.autoCount < 2) return slotLabel(i);
    return `${slotLabel(i)} ${this.gen + 1}/${this.autoCount}`;
  }

  run(game) {
    const i = this.slot;
    const action = this.actions(i)[this.action].id;
    const audio = game.audio;
    if (!this.enabled(i, action)) {
      const why = action === 'save' ? 'non c\'è ancora niente da salvare'
        : action === 'older' ? 'ne ha ancora una sola'
          : 'è vuoto';
      game.hud.toast(`${this.label(i)}: ${why}`, 1.8);
      audio?.ui('deny');
      return null;
    }
    // Scorrere lo storico non perde niente e non chiede conferma: si salta alla
    // generazione occupata dopo, che è sempre più vecchia di quella mostrata.
    if (action === 'older') {
      for (let n = 1; n <= AUTO_GENS; n++) {
        const g = (this.gen + n) % AUTO_GENS;
        if (!this.autos[g]) continue;
        this.gen = g;
        break;
      }
      this.confirm = -1;
      audio?.ui('move');
      return null;
    }
    // Conferma solo dove si perde qualcosa: salvare su uno slot vuoto no.
    if ((action === 'wipe' || (action === 'save' && this.slots[i])) && this.confirm !== this.action) {
      this.confirm = this.action;
      audio?.ui('move');
      return null;
    }
    this.confirm = -1;
    if (action === 'save') {
      const ok = writeSlot(i, game);
      this.refresh();
      game.hud.toast(ok ? `Partita salvata nello ${slotLabel(i).toLowerCase()}` : 'Il browser non lascia salvare', 2.4);
      audio?.ui(ok ? 'ok' : 'deny');
      return null;
    }
    if (action === 'wipe') {
      const what = this.label(i);
      clearSlot(i, i === AUTO_SLOT ? this.gen : 0);
      this.refresh();
      game.hud.toast(`${what} cancellato`, 2);
      audio?.ui('ok');
      return null;
    }
    apply(game, this.data(i));
    audio?.ui('ok');
    game.hud.toast(`${this.label(i)} caricato`, 2.6);
    return 'loaded';
  }

  /**
   * Una scheda per slot. Ognuna dice dove eri, che ora era e con quanto in tasca:
   * senza quelle tre righe uno slot è una data, e fra due partite non si
   * riconosce quale sia quale.
   */
  draw(ctx, game, x, y, w, h, active = true) {
    const mx = game.input.mouse.x;
    const my = game.input.mouse.y;
    this.hover = null;
    const gap = 10;
    const cardH = Math.min(112, (h - 30 - gap * (ALL_SLOTS - 1)) / ALL_SLOTS);
    ctx.textAlign = 'left';
    for (let i = 0; i < ALL_SLOTS; i++) {
      const cy = y + i * (cardH + gap);
      const sel = active && i === this.slot;
      ctx.fillStyle = sel ? 'rgba(255,95,162,0.10)' : 'rgba(255,255,255,0.04)';
      roundPath(ctx, x, cy, w, cardH, 8);
      ctx.fill();
      if (sel) {
        ctx.fillStyle = '#ff5fa2';
        ctx.fillRect(x, cy, 3, cardH);
      }

      const data = this.data(i);
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(235,240,250,0.6)';
      ctx.font = '700 13px system-ui, sans-serif';
      const name = this.label(i);
      ctx.fillText(name, x + 18, cy + 24);
      if (i === AUTO_SLOT) {
        // L'etichetta cambia larghezza con la generazione mostrata: la si misura
        // col font con cui è stata scritta, non con quello che viene dopo.
        const after = x + 30 + ctx.measureText(name).width;
        const on = autosaveOn();
        ctx.fillStyle = on ? 'rgba(90,220,150,0.9)' : 'rgba(235,240,250,0.3)';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillText(on ? '· ACCESO  (F)' : '· SOSPESO  (F)', after, cy + 24);
      }

      if (!data) {
        ctx.fillStyle = 'rgba(235,240,250,0.32)';
        ctx.font = '500 13px system-ui, sans-serif';
        ctx.fillText('vuoto', x + 18, cy + 48);
      } else {
        const d = describe(data, game);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(235,240,250,0.35)';
        ctx.font = '500 11px system-ui, sans-serif';
        ctx.fillText(d.at.toLocaleString('it-IT', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        }), x + w - 18, cy + 24);
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(235,240,250,0.72)';
        ctx.font = '600 14px system-ui, "Apple SD Gothic Neo", sans-serif';
        ctx.fillText(d.place, x + 18, cy + 46);
        ctx.fillStyle = 'rgba(235,240,250,0.42)';
        ctx.font = '500 12px system-ui, sans-serif';
        ctx.fillText(d.clock, x + 18, cy + 64);
        ctx.fillStyle = '#ffd23f';
        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillText(won(d.money), x + 18, cy + 84);
        if (d.stars) {
          ctx.fillStyle = '#ff5fa2';
          ctx.fillText('★'.repeat(d.stars), x + 122, cy + 84);
        }
      }

      // Pulsanti: sempre tutti e tre, ma spenti dove non hanno senso. Nasconderli
      // farebbe ballare la riga fra uno slot pieno e uno vuoto.
      const acts = this.actions(i);
      let bx = x + w - 16;
      for (let a = acts.length - 1; a >= 0; a--) {
        const act = acts[a];
        const on = this.enabled(i, act.id);
        ctx.font = '700 12px system-ui, sans-serif';
        const bw = ctx.measureText(act.label.toUpperCase()).width + 22;
        const bh = 25;
        const bxx = bx - bw;
        const byy = cy + cardH - bh - 11;
        const hot = mx >= bxx && mx <= bxx + bw && my >= byy && my <= byy + bh;
        if (hot && on && active) this.hover = { slot: i, action: a };
        const cur = sel && a === this.action;
        const asking = cur && this.confirm === a;
        ctx.fillStyle = asking ? 'rgba(255,95,162,0.85)'
          : cur ? 'rgba(56,214,255,0.22)' : 'rgba(255,255,255,0.06)';
        roundPath(ctx, bxx, byy, bw, bh, 6);
        ctx.fill();
        if (cur) {
          ctx.strokeStyle = asking ? '#ffffff' : 'rgba(56,214,255,0.8)';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
        ctx.fillStyle = !on ? 'rgba(235,240,250,0.22)' : asking ? '#0b0d11' : cur ? '#ffffff' : 'rgba(235,240,250,0.6)';
        ctx.textAlign = 'center';
        ctx.fillText(act.label.toUpperCase(), bxx + bw / 2, byy + 16);
        ctx.textAlign = 'left';
        bx = bxx - 8;
      }
    }

    // La richiesta di conferma sta qui e non dentro il pulsante: cambiargli
    // l'etichetta gli cambierebbe la larghezza, e le file ballerebbero.
    if (this.confirm >= 0 && active) {
      ctx.fillStyle = '#ff5fa2';
      ctx.font = '700 12px system-ui, sans-serif';
      const what = this.actions(this.slot)[this.confirm].id === 'save' ? 'sovrascrivere' : 'cancellare';
      ctx.fillText(
        `Invio di nuovo per ${what} ${this.label(this.slot).toLowerCase()}`,
        x, y + ALL_SLOTS * (cardH + gap) + 8
      );
    }
  }
}
