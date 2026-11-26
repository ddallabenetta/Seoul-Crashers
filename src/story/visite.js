// Le «visite che cambiano»: chi risponde in modo diverso quando la storia è avanzata.
//
// Il copione sta in `docs/storia/07-radio-kkachi.md`, in fondo: sono **facoltative e
// non le segnala nessuno**, come le chiamate di 까치. Non sono missioni — non hanno
// fasi, non hanno un blip, non stanno nella catena di `campaign.js` — e non sono radio:
// sono un personaggio che c'è sempre, nello stesso posto, e che dice una cosa diversa.
//
// Quella di Jo Ok-bun è la prima, perché M6 è la prima missione che la rende possibile. La
// seconda è **il commesso del 편의점 di Itaewon dopo M8** (§5.42). La terza è **Chun-sik dopo M9**
// (tappa G1b, §5.46).
//
// **Il punto è fisso, non di fase** (`MissionSystem.standing`): una fase sta in piedi finché
// la missione è in corso, e Jo sta dietro il suo banco per tutta la partita. E come per
// ogni punto interattivo del gioco **non porta nessun nome che dica cosa ci si può
// chiedere**: il suggerimento è «parla con Jo», prima e dopo, perché la domanda giusta è
// quella che il giocatore deve comporre da solo — è una delle tre condizioni del finale C
// (`06-finali-ed-epilogo.md`).
import { defineJo, sites as sitiM2 } from './m2.js';
import { defineChunsik, poolSite } from './m1.js';
import { findShop } from './places.js';

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

  // **Il commesso dopo M8.** «Ah, lei è l'altro» — e basta: non aggiunge niente, mai, per tutto il
  // resto del gioco. A differenza di Jo **non è un punto da premere**: il 편의점 ha già il suo `E`
  // (il listino), e una visita permanente sullo stesso bancone lo avrebbe tolto a chi ha fame. Parla
  // da sé la prima volta che si entra dopo M8, **una volta sola** (`flag commesso`, che il
  // salvataggio porta già). Scelta nostra. La riga di prima di M8 — «…di nuovo?» — è già nella
  // cutscene e in M3, e non si ripete.
  let conv;
  game.on('floorShown', (shop, idx) => {
    if (!M.isDone('m8') || M.flag('commesso')) return;
    // La stessa ricerca di M3: due 편의점 sarebbero due commessi.
    conv = conv || findShop(game, 'conv', { district: 'itaewon', near: game.city.spawn });
    if (!conv || shop.id !== conv.id || idx !== conv.level) return;
    M.setFlag('commesso');
    game.dialogue.play(game, [
      { who: 'Commesso', text: '«Ah, lei è l\'altro.»' },
      { text: 'Alza gli occhi dal telefono, lo guarda un secondo, e li riabbassa.' },
    ]);
  });

  // **Chun-sik al 당구장.** Prima di M9 ordina per due e parla di Dong-hyeok al presente; dopo, per uno
  // e al passato, con la sola riga del copione. Scelte nostre, prese con l'utente: dopo M9 resta a
  // Busan (scende a 서면), quindi **al suo sgabello non c'è** finché M10 non è finita — il tempo di un
  // treno —; e come Jo è un punto da premere, non una battuta che parte da sola.
  const lontano = () => M.active === 'm9' || M.active === 'm10' || (M.isDone('m9') && !M.isDone('m10'));
  const chunsik = () => {
    if (!M.isDone('m1') || game.actors.isDead('chunsik')) return;
    if (lontano()) { game.actors.undefine('chunsik'); return; }
    if (!game.actors.defs.has('chunsik')) defineChunsik(game);
  };
  M.afterRestore(chunsik);
  game.on('missionStart', chunsik);
  game.on('missionDone', chunsik);
  const ordine = {
    id: 'chunsik-visita', key: 'E', text: 'parla con Chun-sik', reach: 50, x: 0, y: 0,
    when: () => {
      const s = poolSite(game);
      if (s) { ordine.shop = s.id; ordine.level = s.level; }
      return !!s && M.isDone('m1') && !lontano() && !!game.actors.get('chunsik');
    },
    run: (ctx) => {
      if (!M.isDone('m9')) {
        ctx.talk([
          { text: 'Chun-sik ordina al telefono: due 짜장면, uno senza cipolla.' },
          { who: 'Chun-sik', text: '«Quello senza cipolla è di tuo padre. Lo prende sempre così.»' },
        ]);
        return;
      }
      ctx.talk([
        { text: 'Chun-sik ordina al telefono un 짜장면. Uno solo, e riattacca.' },
        { who: 'Chun-sik', text: '«Tuo padre lo prendeva senza cipolla.» (pausa) «Adesso lo posso dire.»' },
      ]);
    },
  };
  M.standing(ordine);
  game.on('floorShown', (shop, idx, f) => {
    const s = poolSite(game);
    if (!s || shop.id !== s.id || idx !== s.level) return;
    const p = game.actors.get('chunsik');
    ordine.x = p ? p.x : f.entry.x;
    ordine.y = p ? p.y + 22 : f.entry.y;
  });

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
