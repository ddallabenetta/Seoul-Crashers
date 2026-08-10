// M10 · «Jagalchi» — 자갈치
//
// Il mercato, la cassa di Nam, l'officina di Ko e la corsa sotto il ponte sono
// quattro punti veri di Busan. Le mete vengono cercate nella mappa generata e
// registrate anche come mapPoint: sulla carta completa il giocatore vede l'intero
// itinerario, mentre la minimappa segue sempre il blip attivo.
import { panelPhase } from '../core/missions.js';
import { interactPhase, travelPhase, storyPanels } from './storykit.js';

function area(game, id) {
  return game.city?.areas?.find((a) => a.id === id) || null;
}

function site(game, id, u = 0.5, v = 0.5) {
  const lm = game.city?.landmarks?.find((item) => item.id === id);
  if (lm) return { x: lm.x, y: lm.y };
  const a = area(game, 'busan');
  if (a) return { x: a.x0 + a.city.w * u, y: a.y0 + a.city.h * v };
  return { x: game.player.x, y: game.player.y };
}

function pier(game, index = 0) {
  const p = (game.city?.piers || []).filter((item) => item.region === 'busan')[index]
    || game.city?.piers?.[index];
  if (p) return { x: p.x + p.w * 0.55, y: p.y + p.h * 0.5 };
  return site(game, 'jagalchi-market', 0.16, 0.66);
}

function workshop(game) {
  const g = (game.city?.garages || []).find((item) => {
    const a = game.city.areaAt?.(item.cx, item.cy);
    return a?.id === 'busan';
  });
  return g ? { x: g.cx, y: g.cy } : site(game, 'centum-city', 0.72, 0.56);
}

export const APERTURA = storyPanels('m10-apertura', [
  {
    title: '자갈치시장 · Jagalchi',
    text: 'Vasche, ghiaccio e luci gialle. Nam Ji-uk pulisce un coltello senza alzare la testa.',
    hangul: '자갈치시장',
    palette: 1,
    lines: [
      { who: 'Nam Ji-uk', text: '«Suo padre mi ha mandato una cassa nove anni fa e mi ha detto di non aprirla.»' },
      { who: 'Jae-min', text: '«L’ha aperta?»' },
      { who: 'Nam Ji-uk', text: '«Certo. Sono un contrabbandiere, non un santo.»' },
    ],
  },
  {
    title: 'Nove oggetti',
    text: 'Una radiolina, una chiave inglese, un portafoto, un accendino e altri cinque oggetti.',
    hangul: '아홉',
    palette: 2,
    lines: [
      { who: 'Narratore', text: '«Nove oggetti. Sono i gemelli dei nove che Jo Ok-bun tiene sullo scaffale, a Hongdae.»' },
      { who: 'Nam Ji-uk', text: '«Da soli non valgono niente. In fila forse sono un posto.»' },
    ],
  },
  {
    title: 'Il prezzo di Nam',
    text: 'Non vuole denaro: vuole che il carico della notte arrivi alla baia.',
    hangul: '흑사파',
    palette: 4,
    lines: [
      { who: 'Nam Ji-uk', text: '«Porta una cosa per me e ti lascio la cassa. Le motovedette non fanno domande a chi corre.»' },
    ],
  },
]);

export const CHIUSURA = storyPanels('m10-chiusura', [
  {
    title: 'La darsena',
    text: 'La barca entra storta, con il fumo. I nove oggetti sono allineati sul cemento bagnato.',
    hangul: '부산만',
    palette: 0,
  },
  {
    title: 'L’ordine',
    text: 'Il peso decide la fila. Un indirizzo compare nella testa di qualcuno.',
    hangul: '91.45',
    palette: 3,
    lines: [
      { who: '91.45', kkachi: true, text: '«Mettili in fila. Prima quello che pesa meno.»' },
      { who: 'Jae-min', text: '«E in fila cosa vengono?»' },
      { who: '91.45', kkachi: true, text: '«Un indirizzo. È così che si tiene un registro che non si può sequestrare.»' },
    ],
  },
  {
    title: 'La correzione',
    text: 'La frequenza prende male. La voce dice «io», poi corregge: «li ha portati lui».',
    hangul: '서귀포',
    palette: 2,
    lines: [
      { who: '91.45', kkachi: true, text: '«Perché li ho portati io.»' },
      { who: '91.45', kkachi: true, text: '«Perché li ha portati lui.»', note: 'Le altre nove copie restano sullo scaffale di Hongdae.' },
    ],
  },
]);

const openCrate = [
  { who: 'Nam Ji-uk', text: '«Nove anni, nove oggetti. Li ho pesati tutti, ma non ho trovato l’ordine.»' },
  { who: 'Jae-min', text: '«Perché lasciarmeli?»' },
  { who: 'Nam Ji-uk', text: '«Perché tuo padre ha pagato il viaggio. Il resto lo paghi tu.»' },
];

const koLines = [
  { who: 'Ko Eun-bi', text: '«Alle sei devo dire a 한성개발 che lei è a Busan. Pagano come paga lei, e io non scelgo.»' },
  { who: 'Jae-min', text: '«E adesso?»' },
  { who: 'Ko Eun-bi', text: '«Sono le quattro. Vada piano verso una cosa veloce.»' },
];

function addOptionalTerminal(ctx) {
  const game = ctx.game;
  if (ctx.state.terminalSeen || game.missions.flag('dulchaeDead')
    || game.missions.flag('dulchae_dead') || game.actors?.isDead?.('dulchae')) return;
  const p = pier(game, 2);
  game.actors?.define?.('dulchae', {
    x: p.x, y: p.y, kind: 'gangster', name: 'Dulchae', hangul: '둘째',
    angle: Math.PI, state: 'post',
  });
  // Nessun marker e nessun mapPoint: è l'incontro invisibile delle sedie arancioni.
  ctx.point({
    id: 'm10-dulchae-terminal', x: p.x, y: p.y, key: 'E', reach: 74,
    text: 'siediti nella sala d’attesa',
    run: () => {
      ctx.state.terminalSeen = true;
      ctx.drop('m10-dulchae-terminal');
      ctx.game.missions.setFlag('dulchaeAlive');
      ctx.game.missions.setFlag('dulchae_alive');
      ctx.game.missions.setFlag('dulchaeTerminal');
      ctx.talk([
        { who: 'Jae-min', text: '«Mi hai seguito.»' },
        { who: 'Dulchae', text: '«Sapevo l’orario. Non è la stessa cosa.»' },
        { who: 'Jae-min', text: '«Perché non mi fermi?»' },
        { who: 'Dulchae', text: '«Quando torni avrai visto una cosa che io vedo da dodici anni. Portati una giacca.»' },
      ]);
    },
  });
}

function optionalTravel(id, hint, target, opts = {}) {
  const base = travelPhase(id, hint, target, opts);
  return {
    ...base,
    enter(ctx) {
      base.enter(ctx);
      addOptionalTerminal(ctx);
    },
    tick(dt, ctx) {
      if (ctx.game.actors?.isDead?.('dulchae')) {
        ctx.game.missions.setFlag('dulchaeAlive', false);
        ctx.game.missions.setFlag('dulchae_alive', false);
        ctx.game.missions.setFlag('dulchaeDead');
        ctx.game.missions.setFlag('dulchae_dead');
        ctx.drop('m10-dulchae-terminal');
      }
      base.tick?.(dt, ctx);
    },
  };
}

export const M10 = {
  id: 'm10',
  title: 'Jagalchi',
  hangul: '자갈치',
  act: 3,

  phases: [
    panelPhase('m10-apertura', APERTURA),

    optionalTravel('m10-jagalchi', 'Raggiungi il mercato di Jagalchi', (game) => site(game, 'jagalchi-market', 0.24, 0.72), {
      label: '자갈치시장 · Jagalchi', route: true,
    }),

    interactPhase('m10-cassa', 'Apri la cassa che non è pesce', (game) => pier(game, 0),
      'apri la cassa di Nam', openCrate, { label: 'cassa · nove oggetti', color: '#c9a24a', reach: 120 }),

    optionalTravel('m10-officina', 'Vai all’officina di 철마파 a 사상', (game) => workshop(game), {
      label: '사상 · officina', route: true,
    }),

    interactPhase('m10-ko', 'Parla con Ko Eun-bi', (game) => workshop(game),
      'parla con Ko Eun-bi', koLines, { label: 'Ko Eun-bi · 철마파', color: '#ff7a29', reach: 120 }),

    optionalTravel('m10-baia', 'Porta il carico sotto 광안대교', (game) => site(game, 'gwangan-bridge', 0.62, 0.5), {
      label: '광안대교 · baia', route: true,
    }),

    interactPhase('m10-corsa', 'Corri in baia', (game) => site(game, 'gwangan-bridge', 0.62, 0.5),
      'fai partire la corsa', [
        { who: 'Narratore', text: 'Le motovedette entrano nell’inquadratura. L’elicottero passa sopra il ponte. Restano solo i motori.' },
        { who: 'Chun-sik', text: '«Hai mangiato?»' },
        { who: 'Jae-min', text: '(ride)' },
        { who: 'Narratore', text: 'Un colpo prende il motore. La barca arriva alla darsena con il fumo.' },
      ], { label: 'corsa nella baia', color: '#e8595e', reach: 130 }),

    panelPhase('m10-chiusura', CHIUSURA),
  ],

  finish(game) {
    game.missions.setFlag('m10');
    game.missions.setFlag('namObjects');
    game.missions.setFlag('namObjectsNine');
    if (game.actors?.isDead?.('dulchae')) {
      game.missions.setFlag('dulchaeAlive', false);
      game.missions.setFlag('dulchae_alive', false);
      game.missions.setFlag('dulchaeDead');
      game.missions.setFlag('dulchae_dead');
    }
    game.hud?.toast('자갈치 — completata', 3.2);
  },
};

export default M10;
