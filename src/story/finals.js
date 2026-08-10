// Finali, titoli di coda e «2세대».
//
// I finali sono una definizione della MissionSystem soltanto per riusare il
// lettore di pannelli e il salvataggio `seen/flags`: non sono una nuova missione
// del mondo. `startFinals(game)` è l'aggancio pubblico che la campagna chiama
// quando M12 ha finito e ha già alzato il flag `m12`.
import { panelPhase } from '../core/missions.js';
import { storyPanels } from './storykit.js';

const FINAL_KEYS = ['a', 'b', 'c'];

function missionFlag(game, names) {
  const m = game?.missions;
  return (m && names.some((name) => m.flag?.(name))) || false;
}

function readNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.length;
  if (value instanceof Set || value instanceof Map) return value.size;
  if (value && typeof value === 'object') {
    if (Array.isArray(value.heard)) return value.heard.length;
    if (Array.isArray(value.listened)) return value.listened.length;
    if (typeof value.count === 'number') return value.count;
  }
  return null;
}

/**
 * Riconosce le forme che il modulo radio può usare senza imporre un nuovo API.
 * Se nessuna forma esiste, ritorna `null`: in quel caso il finale C resta
 * nascosto, come richiede il copione (non viene concesso per supposizione).
 */
export function radioCallCount(game) {
  const candidates = [
    game?.kkachi?.heard,
    game?.stats?.radioCalls,
    game?.stats?.radioCallsHeard,
    game?.radioCalls,
    game?.radio?.callsHeard,
    game?.radio?.heardCalls,
    game?.kkachi?.heardCount,
    game?.kkachi?.heard,
    game?.story?.radioCalls,
    game?.story?.kkachiCalls,
    game?.missions?.state?.radioCalls,
  ];
  for (const value of candidates) {
    const n = readNumber(value);
    if (n != null) return n;
  }
  if (game?.kkachi?.hiddenReady === true) return 20;
  if (missionFlag(game, ['radioCalls20', 'radio-calls-20', 'kkachi20', 'radio:20'])) return 20;
  return null;
}

function joLighterAvailable(game) {
  return missionFlag(game, [
    'joLighter', 'jo-lighter', 'lighterJo', 'accendinoJo', 'accendino-jo',
    'jo_lighter', 'lighter_jo', 'joQuestion', 'jo-question', 'jo_question',
    'kumangiQuestion', 'kumangi_question',
  ]) || !!game?.story?.joLighter;
}

function dulchaeAliveAvailable(game) {
  const m = game?.missions;
  if (missionFlag(game, ['dulchaeDead', 'dulchae-dead', 'dulchae_dead'])) return false;
  if (missionFlag(game, ['dulchaeAlive', 'dulchae-alive', 'dulchae_alive', 'dulchaeTerminal', 'dulchaeSafe'])) return true;
  if (game?.actors?.isDead?.('dulchae') === true) return false;
  if (game?.actors?.defs?.get?.('dulchae')) return !game.actors.isDead('dulchae');
  // Un modulo precedente può esporre direttamente il fatto in story/flags.
  if (game?.story && typeof game.story.dulchaeAlive === 'boolean') return game.story.dulchaeAlive;
  return m?.flag?.('dulchae') === true ? true : null;
}

/** Condizioni non segnalate del finale C, esposte per test e per il menu finale. */
export function canFinalC(game) {
  const calls = radioCallCount(game);
  const alive = dulchaeAliveAvailable(game);
  return calls != null && calls >= 20 && joLighterAvailable(game) && alive === true;
}

function setFinale(game, key) {
  const upper = key.toUpperCase();
  const m = game.missions;
  for (const k of FINAL_KEYS) {
    const u = k.toUpperCase();
    m.setFlag(`finale-${k}`, k === key);
    m.setFlag(`finale${u}`, k === key);
  }
  // Oltre alle flags persistenti, queste due proprietà rendono il valore
  // immediatamente disponibile a un renderer o a un salvataggio esterno che
  // conosca già l'API `story`.
  game.finalChoice = key;
  if (game.story && typeof game.story === 'object') game.story.finalChoice = key;
  else game.story = { finalChoice: key };
  game.finale = key;
  m.setFlag('finale');
  return upper;
}

export function selectedFinale(game) {
  const direct = game?.finalChoice || game?.story?.finalChoice || game?.finale;
  if (FINAL_KEYS.includes(String(direct).toLowerCase())) return String(direct).toLowerCase();
  for (const key of FINAL_KEYS) if (missionFlag(game, [`finale-${key}`, `finale${key.toUpperCase()}`])) return key;
  return null;
}

const CHOICE_INTRO = (ctx) => storyPanels('final-choice', [{
  title: 'La scelta',
  text: 'Sul tavolo ci sono tre cose: il registro rimesso insieme, il fascicolo di Ha-eun e il calendario delle firme di Jeju.',
  hangul: '선택',
  palette: 4,
  lines: [
    { who: 'Narratore', text: '«Il registro: nove oggetti di Jo e nove di Nam. Trent’anni di chi deve cosa a chi.»' },
    { who: 'Narratore', text: '«Il fascicolo: diciassette anni di indagini. Il calendario: 144 firme tenute al caldo.»' },
    { who: 'Narratore', text: canFinalC(ctx.game)
      ? '«Scegli: 1 · 태워 — bruciare. 2 · 틀어 — trasmettere. 3 · 지워 — cancellare una riga sola.»'
      : '«Scegli: 1 · 태워 — bruciare. 2 · 틀어 — trasmettere.»' },
  ],
}]);

export const FINALE_A = storyPanels('finale-a', [
  { title: '태워 · Il fuoco', text: 'Le carte prendono fuoco nel cestino di metallo. Fuori, il temporale.', hangul: '태워', palette: 1 },
  { title: 'Ryu guarda', text: 'Non spegne il fuoco. «Ha fatto il mio lavoro, con più stile.»', hangul: '류광호', palette: 4 },
  { title: 'Hongdae all’alba', text: 'Per demolire bisogna sapere di chi è. Il quartiere compra altro tempo.', hangul: '홍대', palette: 0 },
  { title: 'Jo sulla strada', text: '«Sospensione dei lavori.» Jo annuisce. «Adesso non deve più pagare nessuno.»', hangul: '전당포', palette: 2 },
  { title: 'Tre tazze', text: 'Chun-sik apre il 당구장 come ogni martedì. Ne riempie due.', hangul: '당구장', palette: 3 },
  { title: 'Nessuno sa', text: 'Jae-min resta in mezzo a Hongdae. Sulla schiena, la banda rossa.', hangul: '백호파', palette: 0 },
]);

export const FINALE_B = storyPanels('finale-b', [
  { title: '틀어 · La trasmissione', text: 'Mi-rae collega nove dischi nel 피시방. Undici ore, poi da capo.', hangul: '피시방', palette: 0 },
  { title: '91.45', text: 'Taxi, minimarket, officina: tutta la città sulla stessa frequenza.', hangul: '91.45', palette: 2 },
  { title: 'I nomi', text: 'La voce di Dong-hyeok legge chi deve, quanto e a chi. Fra i nomi c’è anche il suo.', hangul: '까치', palette: 1 },
  { title: 'Le conseguenze', text: 'Ryu e Pyo arrestati. Nam parte per il Giappone. Chun-sik arrestato. Le bande si sciolgono.', hangul: '검찰', palette: 4 },
  { title: 'Ha-eun', text: 'Diciassette faldoni in aula. Testimonia contro il proprio comando.', hangul: '17', palette: 3 },
  { title: 'La firma', text: 'Jae-min firma una dichiarazione. La grafia è quella di uno dei due.', hangul: '서재민', palette: 0 },
  { title: 'Un anno dopo', text: 'Hongdae è ancora aperta. Il mercato è tornato; il banco dei pegni no.', hangul: '홍대', palette: 2 },
]);

export const FINALE_C = storyPanels('finale-c', [
  { title: '지워 · Una riga sola', text: 'Jae-min strappa la pagina del 1992: 구만기 · 유아 1 · 백호 인수.', hangul: '1992', palette: 1 },
  { title: 'A-112', text: 'Uno sportello comunale. Trentacinque minuti di attesa. Poi una ricevuta.', hangul: 'A-112', palette: 0 },
  { title: 'Un uomo solo', text: 'Dulchae guarda un documento con un nome soltanto. «Perché?» «Quel nome lo hai portato dodici anni.»', hangul: '둘째', palette: 3 },
  { title: 'Lo stesso muretto', text: 'I due siedono senza parlare. Nessuno ha le mani in tasca.', hangul: '서재민', palette: 2 },
  { title: 'Il registro', text: 'Jo lo riceve in una cassetta della frutta e ricomincia a ordinarlo per peso.', hangul: '전당포', palette: 1 },
]);

function finaleScene(key) {
  if (key === 'b') return FINALE_B;
  if (key === 'c') return FINALE_C;
  return FINALE_A;
}

function credits(ctx) {
  const game = ctx.game;
  const deaths = Number(game.stats?.deaths || 0);
  const bands = game.stats?.bandsStanding || game.stats?.gangsStanding || '2 su 4';
  const wakes = game.stats?.hospitalWakes ?? deaths;
  const missed = game.kkachi?.missed?.size ?? game.kkachi?.missed?.length
    ?? game.stats?.radioCallsMissed ?? game.story?.radioCallsMissed ?? 0;
  return storyPanels('titoli', [
    { title: 'Titoli di coda', text: 'La città viva continua sotto i nomi. La camera scende dai sette distretti lungo la Gyeongbu.', hangul: '서울', palette: 0 },
    { title: 'Stato della partita', text: `Bande ancora in piedi: ${bands}. Persone morte in questa storia: ${deaths}.`, hangul: '기록', palette: 2 },
    { title: 'Il conto', text: `Volte in cui Seo Jae-min si è svegliato in ospedale: ${wakes}. Chiamate a cui non ha risposto: ${missed}.`, hangul: '성심', palette: 1 },
    { title: 'La strada', text: 'Una canzone leggera degli anni Novanta passa una volta, piano, sopra la città.', hangul: '경부', palette: 3 },
  ]);
}

function afterTitles(ctx) {
  const key = selectedFinale(ctx.game) || 'a';
  const voice = key === 'b'
    ? 'Mi-rae: «Sei più vecchio della foto.»'
    : key === 'c'
      ? 'Jae-min: «Non ho detto niente di sbagliato, quindi non è quella la domanda.»'
      : 'Jo: «Passo pesante a destra. Scarpa nuova. So chi sei.»';
  return storyPanels('dopo-titoli', [
    { title: '2세대 · Seconda generazione', text: 'Il 피시방 è vuoto. L’armadio contiene nove dischi e il ventilatore gira.', hangul: '2세대', palette: 0 },
    { title: 'La forma d’onda', text: 'Un monitor si muove senza nessuno nella stanza.', hangul: '91.45', palette: 2 },
    { title: 'La spalla', text: 'Una radio si ferma fra 91.4 e 91.5. Nello specchietto passa una sola spalla con la banda rossa.', hangul: '…', palette: 3 },
    { title: 'La voce', text: voice, hangul: '응답', palette: 1 },
    { title: 'Nero', text: '공. 하나. 하나. 넷. 아홉.', hangul: '', palette: 4 },
  ]);
}

function choicePhase() {
  return {
    id: 'final-choice',
    hint: '1 · 태워   2 · 틀어' + (canFinalCHint ? '   3 · 지워' : ''),
    enter(ctx) {
      ctx.unmark();
      ctx.state.wait = 0;
      ctx.state.canC = canFinalC(ctx.game);
      const opts = ctx.state.canC ? '1 · 태워  |  2 · 틀어  |  3 · 지워' : '1 · 태워  |  2 · 틀어';
      ctx.say(opts);
      ctx.toast(`${opts} · premi un tasto numerico`, 12);
    },
    tick(dt, ctx) {
      ctx.state.wait += dt;
      const input = ctx.game.input;
      let key = null;
      if (input.wasPressed('Digit1') || input.wasPressed('Numpad1')) key = 'a';
      else if (input.wasPressed('Digit2') || input.wasPressed('Numpad2')) key = 'b';
      else if ((input.wasPressed('Digit3') || input.wasPressed('Numpad3')) && ctx.state.canC) key = 'c';
      if (!key && ctx.state.wait >= 60) key = 'a';
      if (!key) return;
      setFinale(ctx.game, key);
      ctx.state.final = key;
      ctx.next();
    },
  };
}

// `hint` deve essere una stringa stabile per MissionSystem; la scelta vera viene
// rivalutata in `enter`, quindi il testo statico qui contiene solo le due righe
// sempre disponibili. Il pannello precedente mostra comunque la terza quando c'è.
const canFinalCHint = false;

export const FINALS = {
  id: 'finals',
  title: 'La scelta',
  hangul: '결말',
  act: 3,
  phases: [
    panelPhase('final-choice-intro', CHOICE_INTRO),
    choicePhase(),
    {
      id: 'final-scena',
      hint: 'Il finale',
      enter(ctx) {
        const key = ctx.state.final || selectedFinale(ctx.game) || 'a';
        ctx.panels(`finale-${key}`, finaleScene(key), () => ctx.next());
      },
    },
    {
      id: 'final-titoli',
      hint: 'Titoli di coda',
      enter(ctx) { ctx.panels('titoli', credits(ctx), () => ctx.next()); },
    },
    {
      id: 'final-dopo',
      hint: 'Dopo i titoli',
      enter(ctx) { ctx.panels('dopo-titoli', afterTitles(ctx), () => ctx.next()); },
    },
  ],
  finish(game) {
    game.missions.setFlag('finaliVisti');
    game.hud?.toast(`Finale ${String(selectedFinale(game) || 'a').toUpperCase()} completato`, 4);
  },
};

/** Avvia il blocco finale dopo M12, registrandolo se la campagna non l'ha fatto. */
export function startFinals(game) {
  if (!game?.missions) return false;
  if (!game.missions.defs.has(FINALS.id)) game.missions.register(FINALS);
  if (game.missions.active) return false;
  return game.missions.start(FINALS.id, game);
}

export const FINALE_DEFINITION = FINALS;
export default FINALS;
