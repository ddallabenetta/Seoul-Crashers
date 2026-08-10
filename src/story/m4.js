// M4 · «Molo 7» — 7번 부두
//
// Il porto esiste già nella città generata: si cerca il blocco `port` e si
// appoggiano gli obiettivi al suo nodo stradale più vicino. La sparatoria usa
// normali pedoni ostili, mentre gru e barca sono punti di interazione; così una
// morte o un arresto lascia al sistema missioni soltanto la fase da riprendere.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { createPed } from '../entities/pedestrians.js';
import { findTurf } from './places.js';
import { storyPanels } from './storykit.js';

function roadPoint(game, x, y) {
  const n = game.city.graph?.nearestNode?.(x, y);
  return n ? { x: n.x, y: n.y } : { x, y };
}

function sites(game) {
  if (M4._sites?.city === game.city) return M4._sites;
  const blocks = (game.city.blocks || []).filter((b) => b.type === 'port' && b.district === 'docks');
  const block = blocks[0] || (game.city.blocks || []).find((b) => b.type === 'dock' && b.district === 'docks');
  const landmark = (game.city.landmarks || []).find((lm) => /Terminal container|Incheon/i.test(lm.name));
  const anchor = block
    ? { x: block.x + block.w * 0.62, y: block.y + block.h + 96 }
    : landmark || { x: game.city.w * 0.145, y: game.city.h * 0.8 };
  const office = roadPoint(game, anchor.x, anchor.y);
  const crane = (game.city.props || [])
    .filter((p) => p.type === 'crane')
    .sort((a, b) => dist(a.x, a.y, office.x, office.y) - dist(b.x, b.y, office.x, office.y))[0];
  const cranePoint = crane ? { x: crane.x, y: crane.y } : { x: office.x + 130, y: office.y + 20 };
  const pier = (game.city.piers || [])
    .filter((p) => !p.river)
    .sort((a, b) => dist(a.x, a.y, office.x, office.y) - dist(b.x, b.y, office.x, office.y))[0];
  const boat = pier
    ? { x: pier.x + pier.w - 34, y: pier.y + pier.h / 2 }
    : { x: office.x - 120, y: office.y };
  M4._sites = { city: game.city, office, crane: cranePoint, boat, turf: findTurf(game, 'heuksa', office) };
  return M4._sites;
}

function absoluteMinute(game) {
  return (game.dayCycle?.day || 1) * 1440 + (game.dayCycle?.hour || 0) * 60;
}

function nextClock(game, minute) {
  const now = absoluteMinute(game);
  const today = (game.dayCycle?.day || 1) * 1440 + minute;
  return now <= today ? today : today + 1440;
}

function clearAmbush(game, list) {
  for (const p of list || []) {
    p.gone = true;
    const i = game.peds.indexOf(p);
    if (i >= 0) game.peds.splice(i, 1);
  }
}

const APERTURA = storyPanels('m4-apertura', [
  { palette: 0, hangul: '인천항', title: 'Molo 7 · 22:40', text: 'Il porto di notte: file di container, gru come scheletri, acqua nera e vento.' },
  { palette: 2, hangul: '오세중', title: 'L’ufficio di banchina', text: 'Oh Se-jung, medico legale. Ha firmato l’autopsia di martedì. Il porto non è il suo posto di lavoro.' },
  { palette: 1, title: 'Due fogli', text: 'Un referto autoptico. Accanto, il registro dei movimenti della gru: cosa ha spostato e a che ora.' },
  {
    palette: 4,
    lines: [
      { who: 'Oh', text: '«Il container del molo 7 quella notte non è mai stato movimentato. Lo dice il registro della gru.»' },
      { who: 'Jae-min', text: '«Sul referto c’è scritto che l’ha schiacciato un container.»' },
      { who: 'Oh', text: '«Quell’uomo è morto annegato. Aveva acqua nei polmoni. Ed era alto un metro e settantuno.»' },
    ],
  },
]);

const CHIUSURA = storyPanels('m4-chiusura', [
  { palette: 3, title: 'Foce del Han · alba', text: 'La barca è ferma, il motore spento. L’acqua batte sul fianco.' },
  {
    palette: 1,
    title: 'La riga cerchiata',
    text: '신장 171 cm · statura: un metro e settantuno.',
    lines: [{ note: true, text: 'Sulla patente di Seo Dong-hyeok: 183 cm. Il morto nella bara è alto dodici centimetri meno.' }],
  },
  {
    palette: 4,
    title: 'La fotografia',
    text: 'Nel ritratto del funerale la cicatrice sta a sinistra. Nella fotografia vera di Dong-hyeok sta a destra.',
    lines: [{ note: true, text: 'La stampa del funerale è specchiata. Una così costa mille won.' }],
  },
  {
    palette: 0,
    hangul: '91.45',
    lines: [
      { who: 'Jae-min', text: '«Chi c’è nella bara?»' },
      { kkachi: true, text: '«Un uomo entrato in acqua il 12 marzo e uscito il 14. È il tipo di morto che serve quando devi seppellirne uno con il nome di un altro.»' },
      { who: 'Jae-min', text: '«E mio padre dov’è?»' },
      { kkachi: true, text: '«Non ho detto niente di sbagliato. Non è quella la domanda.»' },
      { note: true, text: 'La stessa frase della prima notte in macchina.' },
    ],
  },
  { palette: 1, hangul: '한성개발', title: 'Molo 7, di giorno', text: 'Perizia in corso. Demolizione prevista: 21 settembre. La stessa data del manifesto di Hongdae.' },
]);

const R1 = storyPanels('m4-r1', [
  { palette: 1, title: 'Il tè freddo', text: 'Retro del 당구장, mattina. Chun-sik siede davanti a tre tazze: due vuote, una piena e fredda.' },
  {
    palette: 2,
    lines: [
      { who: 'Jae-min', text: '«Sapevi che non era lui.»' },
      { who: 'Chun-sik', text: '«Sapevo che dovevo seppellire qualcuno. Chi fosse non me l’hanno detto e non l’ho chiesto.»' },
      { who: 'Jae-min', text: '«Zio.»' },
      { who: 'Chun-sik', text: '«Tuo padre dice sempre una cosa: a Seoul si mente per rispetto.»' },
      { who: 'Jae-min', text: '«Dice.»' },
    ],
  },
  { palette: 1, title: 'Il verbo', text: 'Chun-sik si accorge del presente. Non lo corregge. Beve il tè freddo.', lines: [{ note: true, text: 'È la terza volta in tre giorni che parla di Dong-hyeok al presente.' }] },
]);

export const M4 = {
  id: 'm4',
  title: 'Molo 7',
  hangul: '7번 부두',
  act: 1,

  prepare(game) {
    const s = sites(game);
    // Oh è un pedone nominato: resta nel mondo finché la sparatoria lo raggiunge,
    // e il suo morto entra nel salvataggio come per gli altri attori della storia.
    game.actors?.define?.('oh-sejung', {
      x: s.office.x,
      y: s.office.y,
      kind: 'civil',
      name: 'Oh Se-jung',
      hangul: '오세중',
      state: 'post',
      angle: Math.PI,
    });
  },

  phases: [
    {
      id: 'avvertimento',
      hint: 'Chun-sik ti ha detto di non andare al porto',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.state.warned = true;
        ctx.mapPoint({ id: 'm4-port', x: s.office.x, y: s.office.y, label: '인천항', color: '#ffd23f' });
        ctx.mark(s.office.x, s.office.y, { label: '인천항' });
        ctx.talk([
          { who: 'Chun-sik', text: '«Il porto non è per te. Qualunque cosa tu stia cercando, non andarci.»' },
          { who: 'Jae-min', text: '«Allora ci vado.»' },
        ], () => ctx.next());
      },
    },

    {
      id: 'porto',
      hint: 'Raggiungi il porto di Incheon · 22:40',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.state.target = ctx.state.target ?? nextClock(ctx.game, 22 * 60 + 40);
        ctx.state.arrived = false;
        ctx.mapPoint({ id: 'm4-port', x: s.office.x, y: s.office.y, label: '인천항', color: '#ffd23f' });
        ctx.mark(s.office.x, s.office.y, { label: '인천항' });
      },
      tick(_dt, ctx) {
        const s = sites(ctx.game);
        if (ctx.game.indoors || !s.office) return;
        if (!ctx.state.arrived && dist(ctx.game.player.x, ctx.game.player.y, s.office.x, s.office.y) <= 150) {
          ctx.state.arrived = true;
          ctx.say('Aspetta le 22:40. Il vento porta odore di gasolio.');
        }
        if (!ctx.state.arrived || absoluteMinute(ctx.game) < ctx.state.target) return;
        ctx.unmark();
        ctx.next();
      },
    },

    panelPhase('m4-apertura', APERTURA),

    {
      id: 'documenti',
      hint: 'Prendi il referto e il registro della gru',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mapPoint({ id: 'm4-office', x: s.office.x, y: s.office.y, label: 'ufficio di banchina', color: '#ffd23f' });
        ctx.mark(s.office.x, s.office.y, { label: 'ufficio' });
        ctx.point({
          id: 'm4-documenti', x: s.office.x, y: s.office.y, key: 'E', text: 'entra nell’ufficio di banchina', reach: 82,
          run: () => {
            ctx.drop('m4-documenti');
            ctx.talk([
              { who: 'Oh', hangul: '오세중', text: '«Prendi i due fogli. Il registro della gru dice che il container non si è mosso.»' },
              { who: 'Jae-min', text: '«E il referto?»' },
              { who: 'Oh', text: '«Acqua nei polmoni. 171 centimetri. Il resto l’hanno fatto scrivere a me.»' },
            ], () => ctx.next());
          },
        });
      },
    },

    {
      id: 'sparatoria',
      hint: 'Attraversa i container e raggiungi la gru',
      enter(ctx) {
        const game = ctx.game;
        const s = sites(game);
        clearAmbush(game, M4._ambush);
        M4._ambush = [];
        ctx.state.ohDead = !!game.actors?.isDead?.('oh-sejung');
        // Quattro incursori normali bastano a dare copertura e angoli ciechi;
        // il traffico della città continua a fare il resto del rumore del porto.
        const rng = game.pedSystem?.rng || game.rng;
        if (rng) {
          for (let i = 0; i < 4; i++) {
            const p = createPed('gangster', s.office.x + (i % 2 ? 1 : -1) * (130 + i * 18), s.office.y + (i < 2 ? -1 : 1) * (90 + i * 16), rng);
            p.hostile = true;
            p.armed = true;
            p.state = 'hostile';
            p.role = 'm4-ambush';
            p.ev = M4._ambush;
            game.peds.push(p);
            M4._ambush.push(p);
          }
        }
        game.hud.toast('Sei dentro un corridoio di container · trova copertura', 3.2);
        ctx.mapPoint({ id: 'm4-crane', x: s.crane.x, y: s.crane.y, label: 'gru', color: '#ffd23f' });
        ctx.mark(s.crane.x, s.crane.y, { label: 'gru' });
        ctx.point({
          id: 'm4-crane', x: s.crane.x, y: s.crane.y, key: 'E', text: 'sali sulla gru', reach: 76,
          run: () => {
            ctx.drop('m4-crane');
            ctx.toast('Dall’alto vedi tutto il porto', 2.4);
            ctx.next();
          },
        });
      },
      tick(dt, ctx) {
        const game = ctx.game;
        if (ctx.state.timer === undefined) ctx.state.timer = 0;
        ctx.state.timer += dt;
        if (!ctx.state.ohDead) {
          const oh = game.actors?.get?.('oh-sejung');
          // Oh cade dopo i primi scambi di fuoco, non come un pannello di
          // presentazione: il giocatore deve poterlo vedere ancora in piedi
          // quando la sparatoria comincia.
          if (oh && ctx.state.timer > 2.8) {
            ctx.state.ohDead = true;
            game.damagePed(oh, oh.hp + 20, 0, 0, null);
          }
        }
        // Se il giocatore resta fermo, i nemici continuano a fare il loro lavoro;
        // la meta resta il solo modo affidabile di uscire dalla fase dopo un
        // respawn, perché il motore delle missioni la riapparecchia da capo.
      },
      leave(ctx) {
        clearAmbush(ctx.game, M4._ambush);
        M4._ambush = null;
      },
    },

    {
      id: 'fuga-barca',
      hint: 'Raggiungi il motoscafo al molo',
      enter(ctx) {
        const s = sites(ctx.game);
        ctx.mapPoint({ id: 'm4-boat', x: s.boat.x, y: s.boat.y, label: 'motoscafo', color: '#4ad9ff' });
        ctx.mark(s.boat.x, s.boat.y, { label: 'motoscafo', route: false });
        ctx.point({
          id: 'm4-boat', x: s.boat.x, y: s.boat.y, key: 'E', text: 'sali sul motoscafo', reach: 90,
          run: () => {
            ctx.drop('m4-boat');
            // Un reato grosso porta la caccia al livello in cui il mondo sa usare
            // motovedette ed elicottero, senza inventare unità mission-specifiche.
            ctx.game.wanted?.add(52, ctx.game);
            ctx.talk([
              { text: 'Il motoscafo lascia il molo. Dietro, sei furgoni e fari che rimbalzano sull’acqua.' },
              { kkachi: true, text: '«Tre stelle. Il porto non lascia testimoni.»' },
            ], () => ctx.next());
          },
        });
      },
    },

    panelPhase('m4-chiusura', CHIUSURA),
    panelPhase('m4-r1', R1),
  ],

  finish(game) {
    game.missions.setFlag('m4_documents');
    game.missions.setFlag('atto1');
    game.hud.toast('7번 부두 — Atto I completato', 3.6);
  },
};
