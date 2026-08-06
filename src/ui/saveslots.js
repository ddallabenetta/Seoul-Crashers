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
  ALL_SLOTS, AUTO_SLOT, readSlot, writeSlot, clearSlot, describe, apply,
  slotLabel, autosaveOn, toggleAutosave,
} from '../core/save.js';

// Azioni di uno slot. `Salva` vale sempre, le altre due solo su uno slot
// occupato: A/D scelgono la colonna, W/S la riga, Invio conferma.
const ACTIONS = [
  { id: 'save', label: 'Salva' },
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
  }

  refresh() {
    this.slots = [];
    for (let i = 0; i < ALL_SLOTS; i++) this.slots.push(readSlot(i));
  }

  /** Vero se c'è almeno un salvataggio da riaprire. */
  get any() {
    return this.slots.some(Boolean);
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
    if (input.wasPressed('KeyD') || input.wasPressed('ArrowRight')) {
      this.action = (this.action + 1) % ACTIONS.length;
    }
    if (input.wasPressed('KeyA') || input.wasPressed('ArrowLeft')) {
      this.action = (this.action - 1 + ACTIONS.length) % ACTIONS.length;
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
    return !!this.slots[i];
  }

  run(game) {
    const i = this.slot;
    const action = ACTIONS[this.action].id;
    const audio = game.audio;
    if (!this.enabled(i, action)) {
      const why = action === 'save'
        ? (i === AUTO_SLOT ? 'lo scrive il gioco da solo' : 'non c\'è ancora niente da salvare')
        : 'è vuoto';
      game.hud.toast(`${slotLabel(i)}: ${why}`, 1.8);
      audio?.ui('deny');
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
      clearSlot(i);
      this.refresh();
      game.hud.toast(`${slotLabel(i)} cancellato`, 2);
      audio?.ui('ok');
      return null;
    }
    apply(game, this.slots[i]);
    audio?.ui('ok');
    game.hud.toast(`${slotLabel(i)} caricato`, 2.6);
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

      const data = this.slots[i];
      ctx.fillStyle = sel ? '#ffffff' : 'rgba(235,240,250,0.6)';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(slotLabel(i), x + 18, cy + 24);
      if (i === AUTO_SLOT) {
        const on = autosaveOn();
        ctx.fillStyle = on ? 'rgba(90,220,150,0.9)' : 'rgba(235,240,250,0.3)';
        ctx.font = '600 11px system-ui, sans-serif';
        ctx.fillText(on ? '· ACCESO  (F)' : '· SOSPESO  (F)', x + 74, cy + 24);
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
      let bx = x + w - 16;
      for (let a = ACTIONS.length - 1; a >= 0; a--) {
        const act = ACTIONS[a];
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
      const what = ACTIONS[this.confirm].id === 'save' ? 'sovrascrivere' : 'cancellare';
      ctx.fillText(
        `Invio di nuovo per ${what} ${slotLabel(this.slot).toLowerCase()}`,
        x, y + ALL_SLOTS * (cardH + gap) + 8
      );
    }
  }
}
