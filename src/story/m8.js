// M8 · «Il volto in mezzo alla folla» — 인파 속의 얼굴
//
// Mi-rae, la busta del nove e Dulchae chiudono l'Atto II. La folla generata dal
// motore resta libera: la missione usa il punto della destinazione per rendere
// il pedinamento giocabile anche quando la città è in modalità probe, mentre
// l'attore `dulchae` può essere ucciso davvero dal giocatore e conserva il fatto
// nel salvataggio dell'ActorSystem.
import { panelPhase } from '../core/missions.js';
import { dist } from '../core/math.js';
import { findShop, freeSpot } from './places.js';
import { storyPanels } from './storykit.js';

function sites(game) {
  if (M8._sites?.game === game) return M8._sites.value;
  const from = game.city?.spawn || game.player || { x: 0, y: 0 };
  const pcbang = findShop(game, 'pcbang', { district: 'hongdae', near: from })
    || findShop(game, 'conv', { district: 'hongdae', near: from });
  const crowdShop = findShop(game, 'conv', { district: 'myeongdong', near: from, avoid: [pcbang?.id] })
    || findShop(game, 'clothes', { district: 'myeongdong', near: from, avoid: [pcbang?.id] });
  const d = game.city?.districts?.find((q) => q.id === 'myeongdong');
  const target = crowdShop
    ? { x: crowdShop.x, y: crowdShop.y }
    : d
      ? { x: d.seed.x * game.city.w, y: d.seed.y * game.city.h }
      : { x: game.city.w * 0.7, y: game.city.h * 0.2 };
  const value = { pcbang, crowdShop, target };
  M8._sites = { game, value };
  return value;
}

function addMap(ctx, id, label, p, color = '#ffd23f') {
  ctx.dropMapPoint(id);
  ctx.mapPoint({ id, x: p.x, y: p.y, label, color });
}

function floorPoint(ctx, id, text, run) {
  const game = ctx.game;
  const s = sites(game).pcbang;
  const addInside = (shop, level, floor) => {
    if (!s || shop.id !== s.id || level !== (s.level || 0)) return;
    const a = freeSpot(floor, { x: floor.w * 0.52, y: floor.h * 0.48 });
    ctx.drop(id);
    ctx.point({ id, shop: s.id, level: s.level || 0, key: 'E', text, x: a.x, y: a.y, reach: 58, run });
  };
  ctx.on('floorShown', addInside);
  if (!game.indoors) {
    const p = sites(game).pcbang || sites(game).target;
    if (p) {
      ctx.drop(id);
      ctx.point({ id, key: 'E', text, x: p.x, y: p.y, reach: 92, run });
    }
  }
  const active = game.shops?.active;
  if (active && game.shops.floor) addInside(active.shop, active.cur, game.shops.floor);
}

function reach(ctx, p, label, id, next) {
  ctx.mark(p.x, p.y, { label, route: true });
  addMap(ctx, id, label, p);
  ctx.point({
    id: `${id}-arrive`, key: 'E', text: `raggiungi ${label}`, x: p.x, y: p.y, reach: 96,
    run: () => { ctx.drop(`${id}-arrive`); next(); },
  });
}

export const APERTURA = storyPanels('m8-open', [
  {
    palette: 2,
    hangul: '피시방',
    title: 'Hongdae, terzo piano',
    text: 'Trenta schermi accesi, nessun cliente alle undici del mattino. Mi-rae tiene il turno di notte.',
  },
  {
    palette: 2,
    hangul: '서미래',
    title: 'Nove fotogrammi',
    text: 'Nove volte lo stesso bomber, nove date, dodici anni. In tre Jae-min era a Los Angeles: i timbri sono sul passaporto.',
  },
  {
    palette: 2,
    hangul: '9',
    title: 'Il giorno della busta',
    lines: [
      { who: 'Mi-rae', text: '«Oggi è il nove. Alle due uno con il tuo giubbotto ritira una busta a 명동.»' },
      { who: 'Jae-min', text: '«Perché mi aiuti?»' },
      { who: 'Mi-rae', text: '«Il nove arrivavano soldi anche a me. Il mese scorso non sono arrivati.»' },
    ],
  },
  {
    palette: 2,
    hangul: '서동혁',
    title: 'Buongiorno, sorella',
    lines: [
      { who: 'Jae-min', text: '«Tuo padre?»' },
      { who: 'Mi-rae', text: '«Seo Dong-hyeok. Non mi ha mai riconosciuta e io non gliel\'ho mai chiesto.»' },
      { who: 'Mi-rae', text: '«Quindi sì: buongiorno, ciao, sono tua sorella. Vai.»' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m8-close', [
  {
    palette: 2,
    hangul: '서재민',
    title: 'Stesso bomber',
    text: 'Due uomini, stessa altezza, stessa banda rossa sulla schiena. Uno ha la mano destra in tasca.',
  },
  {
    palette: 2,
    hangul: '둘째',
    title: 'Il secondo',
    lines: [
      { who: 'Dulchae', text: '«Hyung.»' },
      { who: 'Jae-min', text: '«Non chiamarmi così.»' },
      { who: 'Dulchae', text: '«È l\'unica parola che ho di mio. Il resto è tuo.»' },
      { who: 'Narratore', text: 'Due carte d\'identità: stesso nome, stessa data, stesso numero di registro.' },
    ],
  },
  {
    palette: 2,
    hangul: '서미래',
    title: 'La stessa riga',
    lines: [
      { who: 'Dulchae', text: '«Ti hanno mandato in America perché non ricordassi. Hanno tenuto me per le firme.»' },
      { who: 'Dulchae', text: '«Tu sei il nome pulito. Io sono il nome usato.»' },
      { who: 'Jae-min', text: '«Chi ti ha tenuto?»' },
      { who: 'Dulchae', text: '«Gli stessi che mandano i soldi a tua sorella. Guarda l\'intestazione.»' },
    ],
  },
  {
    palette: 2,
    hangul: '91.45',
    title: 'R3 · I nove dischi',
    lines: [
      { who: 'Mi-rae', text: '«Non è un chi. Sono trent\'anni di citofoni, telefonate e videocassette. Io la tengo accesa.»' },
      { who: 'Jae-min', text: '«E la voce di chi è?»' },
      { who: 'Mi-rae', text: '«Di quello che parlava di più. Cioè tuo padre.»' },
      { who: 'Narratore', text: 'Il quadrante della radio resta fermo su 91.45 per cinque secondi.' },
    ],
  },
]);

export const M8 = {
  id: 'm8',
  title: 'Il volto in mezzo alla folla',
  hangul: '인파 속의 얼굴',
  act: 2,

  prepare(game) {
    const s = sites(game);
    if (s.pcbang) game.shops?.hold?.(s.pcbang.id);
    if (!game.missions.flag('dulchae_alive')) game.missions.setFlag('dulchae_alive');
    if (s.pcbang && game.actors?.define) {
      game.actors.define('mirae', {
        indoor: true,
        shop: s.pcbang.id,
        level: s.pcbang.level || 0,
        kind: 'student',
        name: 'Seo Mi-rae',
        hangul: '서미래',
        angle: Math.PI / 2,
        place: (f) => freeSpot(f, { x: f.w * 0.65, y: f.h * 0.42 }),
      });
    }
    // L'altro Jae-min è una persona normale senza arma. Se il giocatore lo
    // attacca, ActorSystem salva `dead` e la missione registra l'occasione M8.
    if (game.actors?.define) {
      const p = s.target;
      game.actors.define('dulchae', {
        x: p.x,
        y: p.y,
        kind: 'gangster',
        name: 'Dulchae',
        hangul: '둘째',
        angle: Math.PI,
        state: 'post',
      });
    }
  },

  phases: [
    panelPhase('m8-apertura', APERTURA),
    {
      id: 'pcbang',
      hint: 'Vai al 피시방 di Hongdae',
      enter(ctx) {
        const s = sites(ctx.game).pcbang;
        if (!s) { ctx.next(); return; }
        ctx.mark(s.x, s.y, { label: '피시방', route: true });
        addMap(ctx, 'm8-pcbang', '피시방', s, '#38d6ff');
        ctx.point({
          id: 'm8-pcbang-arrive', key: 'E', text: 'entra nel 피시방', x: s.x, y: s.y, reach: 92,
          run: () => { ctx.drop('m8-pcbang-arrive'); ctx.next(); },
        });
        ctx.on('shopEnter', (shop) => { if (shop.id === s.id) ctx.next(); });
      },
    },
    {
      id: 'mirae',
      hint: 'Parla con Mi-rae',
      enter(ctx) {
        ctx.unmark();
        floorPoint(ctx, 'm8-mirae', 'parla con Mi-rae', () => {
          ctx.drop('m8-mirae');
          ctx.flag('mirae_sister');
          ctx.talk([
            { who: 'Mi-rae', text: '«Sei più vecchio della foto. Quella del ventidue luglio, dell\'anno scorso e di Busan.»' },
            { who: 'Jae-min', text: '«Sono io tutte le volte?»' },
            { who: 'Mi-rae', text: '«No. Uno con il tuo giubbotto ritira una busta oggi alle due.»' },
            { who: 'Mi-rae', text: '«Mio padre era Dong-hyeok. Il bonifico di agosto non è arrivato.»' },
          ], () => ctx.next());
        });
      },
    },
    {
      id: 'folla',
      hint: 'Trova nella folla il bomber con la banda rossa',
      enter(ctx) {
        const p = sites(ctx.game).target;
        ctx.state.targetSeen = false;
        reach(ctx, p, '명동 · ore 14:00', 'm8-crowd', () => {
          if (ctx.state.targetSeen) return;
          ctx.state.targetSeen = true;
          ctx.dropMapPoint('m8-crowd');
          ctx.unmark();
          const dead = ctx.game.actors?.isDead?.('dulchae');
          if (dead) {
            ctx.flag('dulchae_alive', false);
            ctx.flag('dulchaeAlive', false);
            ctx.flag('dulchae_dead');
            ctx.flag('dulchaeDead');
          } else {
            ctx.flag('dulchae_alive');
            ctx.flag('dulchaeAlive');
            ctx.flag('dulchae_dead', false);
            ctx.flag('dulchaeDead', false);
          }
          ctx.talk([
            { who: 'Narratore', text: 'Il vicolo cieco: due uomini, nessuno che guarda. Stesso bomber, stessa altezza.' },
            { who: 'Narratore', text: dead ? 'Il portafoglio dell\'altro è rimasto a terra.' : 'Dulchae tira fuori un portafoglio, non una pistola.' },
            { who: 'Dulchae', text: '«서재민. Stesso nome, stessa data di nascita, stesso numero di registro.»' },
            { who: 'Jae-min', text: '«Chi ti ha tenuto?»' },
            { who: 'Dulchae', text: '«Gli stessi che mandano i soldi a tua sorella. Se muori tu, resta un nome solo.»' },
            { note: true, text: dead ? 'Dulchae non risponde più. L\'occasione M8 è persa.' : 'Dulchae se ne va camminando. Non ha sparato.' },
          ], () => ctx.next());
        });
      },
    },
    panelPhase('m8-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m8_two_jaemin');
    game.missions.setFlag('mirae_sister');
    // Se il personaggio è stato ucciso prima della scena, il flag resta falso;
    // altrimenti la missione ribadisce esplicitamente che è vivo.
    if (game.actors?.isDead?.('dulchae')) {
      game.missions.setFlag('dulchae_alive', false);
      game.missions.setFlag('dulchaeAlive', false);
      game.missions.setFlag('dulchae_dead');
      game.missions.setFlag('dulchaeDead');
    } else {
      game.missions.setFlag('dulchae_alive');
      game.missions.setFlag('dulchaeAlive');
      game.missions.setFlag('dulchae_dead', false);
      game.missions.setFlag('dulchaeDead', false);
    }
    game.hud.toast('인파 속의 얼굴 — completata', 3.2);
  },
};
