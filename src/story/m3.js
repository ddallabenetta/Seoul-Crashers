// M3 · «Il turno di notte» — 야간 근무
//
// La missione mette in fila l'orologio, la pioggia e il primo pedinamento.
// Il gioco non ha un'auto guidata dalla sceneggiatura: l'auto nera è quindi un
// obiettivo mobile leggero, con soglia di distanza e arrivo alla destinazione.
// È la stessa promessa del copione («ti ha visto / l'hai perso») senza creare un
// secondo sistema di traffico che potrebbe restare nel mondo dopo una morte.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { findShop, freeSpot } from './places.js';
import { storyPanels } from './storykit.js';

function sites(game) {
  if (M3._sites?.city === game.city) return M3._sites;
  const conv = findShop(game, 'conv', { district: 'itaewon', near: game.city.spawn });
  const landmark = (game.city.landmarks || []).find((lm) => /COEX Mall|Gangnam/i.test(lm.name));
  const fallback = (game.city.districts || []).find((d) => d.id === 'gangnam');
  const parking = landmark || (fallback ? { x: fallback.seed.x * game.city.w, y: fallback.seed.y * game.city.h } : game.city.spawn);
  // Il parcheggio è sotto una torre, ma il punto giocabile resta sulla strada:
  // la rotta usa il nodo più vicino e non manda il giocatore dentro un volume.
  const node = game.city.graph?.nearestNode?.(parking.x, parking.y);
  const lot = node ? { x: node.x, y: node.y } : { x: parking.x, y: parking.y };
  M3._sites = { city: game.city, conv, lot };
  return M3._sites;
}

function absoluteMinute(game) {
  return (game.dayCycle?.day || 1) * 1440 + (game.dayCycle?.hour || 0) * 60;
}

/** Restituisce il prossimo appuntamento, mai quello già passato. */
function nextClock(game, minute) {
  const now = absoluteMinute(game);
  const today = (game.dayCycle?.day || 1) * 1440 + minute;
  return now <= today ? today : today + 1440;
}

const APERTURA = storyPanels('m3-apertura', [
  {
    palette: 0,
    hangul: '편의점',
    title: '03:20 · Itaewon',
    text: 'Piove. Un solo minimarket resta acceso all’incrocio.',
    lines: [{ kkachi: true, text: '«Alle quattro, all’incrocio di Itaewon, quello del minimarket. Guarda e basta: non entrare.»' }],
  },
  {
    palette: 3,
    hangul: '이태원',
    title: 'Dall’altra parte della strada',
    text: 'Un’auto è ferma con i vetri appannati dall’interno. Qualcuno sta guardando lo stesso posto.',
    lines: [{ note: true, text: 'Il motore è spento. È lì da un pezzo.' }],
  },
]);

const CHIUSURA = storyPanels('m3-chiusura', [
  {
    palette: 0,
    title: 'La rampa di Gangnam',
    text: 'Due auto muso a muso. I fari tagliano la pioggia che entra dal parcheggio.',
  },
  {
    palette: 4,
    hangul: '종로경찰서',
    title: 'Yoon Ha-eun',
    text: 'Ispettrice della squadra omicidi di Jongno. Diciassette anni di servizio.',
    lines: [
      { who: 'Ha-eun', text: '«Bel giubbotto. Le sta grande.»' },
      { who: 'Jae-min', text: '«Era di mio padre.»' },
      { who: 'Ha-eun', text: '«Lo so. Il giorno del funerale era a Myeongdong, addosso a uno che camminava. Se ne vada. Non oggi.»' },
    ],
  },
  {
    palette: 1,
    hangul: '홍대',
    title: 'La cartellina sul sedile',
    text: 'Una planimetria di Hongdae, strada per strada, con i numeri civici e i nomi di chi ci abita.',
    lines: [{ note: true, text: 'Non è una mappa di reati. È una mappa di case.' }],
  },
]);

export const M3 = {
  id: 'm3',
  title: 'Il turno di notte',
  hangul: '야간 근무',
  act: 1,

  prepare(game) {
    const s = sites(game);
    if (s.conv) game.shops.hold(s.conv.id);
  },

  phases: [
    {
      id: 'innesco',
      hint: 'Itaewon · minimarket · 03:20',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.conv) { ctx.next(); return; }
        const target = nextClock(ctx.game, 3 * 60 + 20);
        ctx.state.target = ctx.state.target ?? target;
        ctx.state.arrived = false;
        ctx.mapPoint({ id: 'm3-conv', x: s.conv.x, y: s.conv.y, label: '편의점', color: '#4ad98a' });
        ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        ctx.say(`Appuntamento alle 03:20 · ${ctx.game.dayCycle?.clock || 'notte'}`);
      },
      tick(_dt, ctx) {
        const s = sites(ctx.game);
        if (!s.conv || ctx.game.indoors) return;
        if (!ctx.state.arrived && dist(ctx.game.player.x, ctx.game.player.y, s.conv.x, s.conv.y) <= 130) {
          ctx.state.arrived = true;
          ctx.say('Aspetta che scocchino le 03:20');
        }
        if (!ctx.state.arrived || absoluteMinute(ctx.game) < ctx.state.target) return;
        ctx.unmark();
        ctx.next();
      },
    },

    panelPhase('m3-apertura', APERTURA),

    {
      id: 'attesa',
      hint: 'Aspetta il consegnatario delle 04:00',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.state.delivery = ctx.state.delivery || nextClock(ctx.game, 4 * 60);
        ctx.state.commented = false;
        if (!s.conv) { ctx.next(); return; }
        ctx.mapPoint({ id: 'm3-conv', x: s.conv.x, y: s.conv.y, label: '편의점', color: '#4ad98a' });
        ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
        // Il commesso è facoltativo: il punto esiste solo sulla pianta del locale
        // e si smonta da solo quando la fase finisce.
        const place = (shop, idx, floor) => {
          if (shop.id !== s.conv.id || idx !== s.conv.level || !floor || ctx.state.commented) return;
          const p = freeSpot(floor, { x: floor.till?.x || floor.w * 0.7, y: floor.till?.y || floor.h * 0.5 });
          ctx.point({
            id: 'm3-commesso', shop: s.conv.id, level: s.conv.level, x: p.x, y: p.y,
            key: 'E', text: 'parla col commesso', reach: 52,
            run: () => {
              if (ctx.state.commented) return;
              ctx.state.commented = true;
              ctx.drop('m3-commesso');
              ctx.talk([
                { who: 'Commesso', text: '«Il caffè caldo l’ha già preso stanotte, no? Alle due.»' },
                { who: 'Jae-min', text: '«Alle due dormivo.»' },
                { who: 'Commesso', text: '«Sì sì. Comunque uguale, sono milleduecento.»' },
              ]);
            },
          });
        };
        ctx.on('floorShown', place);
        const it = ctx.game.shops.active;
        if (it && ctx.game.shops.floor) place(it.shop, it.cur, ctx.game.shops.floor);
      },
      tick(_dt, ctx) {
        if (ctx.state.delivery > absoluteMinute(ctx.game)) return;
        ctx.state.delivery = Infinity;
        ctx.talk([
          { text: 'Alle 04:00 arriva un’auto. Un uomo del 백호파 posa una busta sul banco del 편의점 e riparte senza parlare.' },
        ], () => ctx.next());
      },
    },

    {
      id: 'ritiro',
      hint: 'Alle 04:06 arriva una seconda auto',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.state.pickup = ctx.state.pickup || nextClock(ctx.game, 4 * 60 + 6);
        ctx.mapPoint({ id: 'm3-conv', x: s.conv.x, y: s.conv.y, label: '편의점', color: '#4ad98a' });
        ctx.mark(s.conv.x, s.conv.y, { label: '편의점' });
      },
      tick(_dt, ctx) {
        if (ctx.state.pickup > absoluteMinute(ctx.game)) return;
        ctx.state.pickup = Infinity;
        ctx.talk([
          { text: 'Alle 04:06 arriva una berlina nera, pulita, con una targa nuova. Una donna in completo prende la busta e paga un caffè con la carta.' },
        ], () => ctx.next());
      },
    },

    {
      id: 'pedinamento',
      hint: 'Segui la berlina nera fino a Gangnam',
      enter(ctx) {
        const s = sites(ctx.game);
        if (!s.conv || !s.lot) { ctx.next(); return; }
        ctx.state.lead = { x: s.conv.x, y: s.conv.y };
        ctx.state.followT = 0;
        ctx.state.lostT = 0;
        ctx.state.routeHint = false;
        ctx.mapPoint({ id: 'm3-gangnam', x: s.lot.x, y: s.lot.y, label: '한성개발', color: '#38d6ff' });
        ctx.mark(s.conv.x, s.conv.y, { label: 'berlina nera' });
        ctx.talk([
          { kkachi: true, text: '«Abbassa.»' },
          { who: 'Jae-min', text: '«Sei una radio. Non ti sente nessuno.»' },
          { kkachi: true, text: '«Abbassa lo stesso.»' },
        ], () => {
          ctx.state.routeHint = true;
          ctx.toast('Pedinamento: resta abbastanza vicino alla berlina', 4);
        });
      },
      tick(dt, ctx) {
        const s = sites(ctx.game);
        if (!s.conv || !s.lot || ctx.game.indoors || ctx.game.dialogue.active) return;
        const lead = ctx.state.lead;
        if (!lead) return;
        const total = Math.max(1, dist(s.conv.x, s.conv.y, s.lot.x, s.lot.y));
        ctx.state.followT = Math.min(1, ctx.state.followT + dt * 190 / total);
        lead.x = s.conv.x + (s.lot.x - s.conv.x) * ctx.state.followT;
        lead.y = s.conv.y + (s.lot.y - s.conv.y) * ctx.state.followT;
        // Il marker segue l'auto, mentre la rotta principale resta sulla carta.
        ctx.mark(lead.x, lead.y, { label: 'berlina nera' });
        const gap = dist(ctx.game.player.x, ctx.game.player.y, lead.x, lead.y);
        if (gap > 980) ctx.state.lostT += dt; else ctx.state.lostT = Math.max(0, ctx.state.lostT - dt * 2);
        if (ctx.state.lostT > 4) {
          ctx.state.lostT = 0;
          ctx.state.followT = Math.max(0, ctx.state.followT - 0.16);
          ctx.toast('L’hai persa nella pioggia · ritrova la berlina', 3);
        }
        if (ctx.state.followT < 1 || dist(ctx.game.player.x, ctx.game.player.y, s.lot.x, s.lot.y) > 150) return;
        ctx.unmark();
        ctx.next();
      },
    },

    {
      id: 'haeun',
      hint: 'La rampa è bloccata',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.state.done = false;
        ctx.mapPoint({ id: 'm3-gangnam', x: s.lot.x, y: s.lot.y, label: '한성개발', color: '#38d6ff' });
        ctx.mark(s.lot.x, s.lot.y, { label: 'rampa' });
      },
      tick(_dt, ctx) {
        const s = sites(ctx.game);
        if (ctx.state.done || ctx.game.indoors || dist(ctx.game.player.x, ctx.game.player.y, s.lot.x, s.lot.y) > 160) return;
        ctx.state.done = true;
        ctx.talk([
          { who: 'Jae-min', text: '«Il 백호파 non gli sta chiedendo il pizzo.»' },
          { kkachi: true, text: '«No.»' },
          { who: 'Jae-min', text: '«Glielo sta pagando. La busta parte da noi e arriva a loro.»' },
          { kkachi: true, text: '«Ogni martedì e ogni venerdì. Da dodici anni. Quello che paga non lo demoliscono.»' },
        ], () => ctx.next());
      },
    },

    panelPhase('m3-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m3');
    game.hud.toast('야간 근무 — completata', 3.2);
  },
};
