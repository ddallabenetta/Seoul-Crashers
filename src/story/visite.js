// Le «visite che cambiano»: chi risponde in modo diverso quando la storia è avanzata.
//
// Il copione sta in `docs/storia/07-radio-kkachi.md`, in fondo: sono **facoltative e
// non le segnala nessuno**, come le chiamate di 까치. Non sono missioni — non hanno
// fasi, non hanno un blip, non stanno nella catena di `campaign.js` — e non sono radio:
// sono un personaggio che c'è sempre, nello stesso posto, e che dice una cosa diversa.
//
// Quella di Jo Ok-bun è la prima, perché M6 è la prima missione che la rende possibile.
// Chun-sik dopo M9 e il commesso dopo M8 vengono con le loro missioni.
//
// **Il punto è fisso, non di fase** (`MissionSystem.standing`): una fase sta in piedi finché
// la missione è in corso, e Jo sta dietro il suo banco per tutta la partita. E come per
// ogni punto interattivo del gioco **non porta nessun nome che dica cosa ci si può
// chiedere**: il suggerimento è «parla con Jo», prima e dopo, perché la domanda giusta è
// quella che il giocatore deve comporre da solo — è una delle tre condizioni del finale C
// (`06-finali-ed-epilogo.md`).
import { defineJo, sites as sitiM2 } from './m2.js';

/**
 * Cosa succede **dopo M6**. «La domanda giusta è dirle che 구만기 è inciso sul proprio
 * orologio»: i due ingredienti — il nome e l'orologio — il giocatore li ha dalla fine di
 * M2, e **li mette in fila lui**. Qui non c'è una scelta di dialogo (`ui/dialogue.js` non
 * ha opzioni, ed è stato deciso così): chi arriva al banco dopo M6 e le parla fa quella
 * domanda, perché è quella che Jae-min ha in testa. **Scelta nostra**, e va dichiarata.
 */
export function attachVisite(game) {
  const M = game.missions;

  // Jo esiste da M2 in poi, anche dopo un caricamento (`prepare` di M2 non gira più).
  M.afterRestore((g) => { if (M.isDone('m2')) defineJo(g); });

  const punto = {
    id: 'jo-visita',
    key: 'E',
    text: 'parla con Jo',
    reach: 56,
    x: 0,
    y: 0,
    // Prima di M2 il banco non è suo: è un negozio. E morta non risponde.
    when: (g) => {
      const s = sitiM2(g).pawn;
      if (s) { punto.shop = s.id; punto.level = s.level; }
      return !!s && M.isDone('m2') && !g.actors.isDead('jo');
    },
    run: (ctx) => {
      if (!M.isDone('m6')) {
        // La stessa riga con cui ci si congeda in M2, e **non una spiegazione**: Jo non
        // dice che non sa. Dice che la domanda è un'altra.
        ctx.talk([{ who: 'Jo', text: '«Torna quando sai fare la domanda giusta.»' }]);
        return;
      }
      if (M.flag('accendino')) {
        ctx.talk([{ who: 'Jo', text: '«Quello che dovevo darti te l\'ho dato. Il resto è sugli scaffali, e lo sai dove.»' }]);
        return;
      }
      ctx.talk([
        { who: 'Jae-min', text: '«구만기. È inciso sul retro del mio orologio.»' },
        { who: 'Jo', text: '«Adesso sì.» (si volta e va allo scaffale giusto, senza tastare)' },
        { text: 'Jo mette sul banco un accendino. Sul fondo, una scritta a punta: 구만기.' },
        { who: 'Jo', text: '«Tuo padre lo ha impegnato il giorno che ti ha preso. Non è mai tornato a riprenderlo.»' },
      ], () => {
        M.setFlag('accendino');
        game.hud.toast('Un accendino inciso: 구만기', 4);
        game.audio?.ui('ok');
      });
    },
  };
  M.standing(punto);

  // Jo sta dove `actors` l'ha messa, non dove pare a noi: la posizione si riprende a ogni
  // volta che il piano si apre (è lo stesso trucco di `joPoint` in M2).
  game.on('floorShown', (shop, idx, f) => {
    const s = sitiM2(game).pawn;
    if (!s || shop.id !== s.id || idx !== s.level) return;
    const p = game.actors.get('jo');
    punto.shop = s.id;
    punto.level = s.level;
    punto.x = p ? p.x : f.entry.x;
    punto.y = p ? p.y + 22 : f.entry.y;
  });
}
