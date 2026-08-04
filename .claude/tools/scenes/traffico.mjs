// Scena di misura del traffico: quanti urti, di che tipo e dove. Serve a dare un
// numero a «il traffico si muove male», che a occhio non si giudica — a schermo si
// vede un tamponamento e sembra un disastro, oppure non se ne vede nessuno per un
// minuto e sembra tutto a posto.
//
//   node .claude/tools/probe.mjs --script .claude/tools/scenes/traffico.mjs \
//        --eval "__traffico" --boot-timeout 60
//
// Dura WARM + MEAS secondi (default 60 + 90). Il riscaldamento non è cortesia: il
// `prewarm` ammassa qualche auto sull'incrocio di partenza e ci mette circa un
// minuto a sciogliersi da solo (HANDOFF §1), e misurare dentro quella finestra dà
// numeri che non c'entrano niente con la guida.
//
// Il risultato finisce in `window.__traffico` invece di essere restituito: così il
// file resta un modulo valido e l'hook `check-js` può controllarlo davvero.
//
// **I numeri vanno confrontati con lo stesso ambiente, non con quelli scritti nel
// HANDOFF**: in un Chromium headless dentro un container calano da soli. Il modo
// onesto è sempre `git worktree add /tmp/base HEAD` e la stessa scena sui due alberi.
const WARM = Number(globalThis.__warm ?? 60);
const MEAS = Number(globalThis.__meas ?? 90);

// `game` è già in scope: probe.mjs inietta il file come corpo di funzione con
// `game` come parametro. Ridichiararlo qui rompe qualunque riga che lo usi prima.
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
await sleep(WARM);

const { VEHICLE_TYPES: SPEC } = await import('/src/render/sprites.js');

// Contatore di urti per posizione. Si intercetta `onVehicleImpact` invece di
// toccare src/: la stessa scena gira identica sul ramo base e su quello modificato.
const hits = [];
const orig = game.onVehicleImpact.bind(game);
game.onVehicleImpact = (v, impact) => {
  orig(v, impact);
  if (impact < 45) return;
  let other = null;
  let od = Infinity;
  for (const o of game.vehicles) {
    if (o === v) continue;
    const d = Math.hypot(o.x - v.x, o.y - v.y);
    if (d < od) { od = d; other = o; }
  }
  const sp = SPEC[v.kind];
  let type = 'muro';
  if (other && od < (sp.len + SPEC[other.kind].len) * 0.62 + 14) {
    // Il tipo si legge dall'angolo fra i due musi: è quello che dice *quale*
    // regola di guida è saltata (coda, precedenza, senso di marcia).
    const da = Math.abs(Math.atan2(Math.sin(other.angle - v.angle), Math.cos(other.angle - v.angle)));
    type = da < 0.7 ? 'tamponamento' : da > 2.45 ? 'frontale' : 'incrocio';
  }
  let nd = Infinity;
  for (const n of game.city.graph.usableNodes) {
    const d = Math.hypot(n.x - v.x, n.y - v.y);
    if (d < nd) nd = d;
  }
  hits.push({ t: +game.time.toFixed(1), type, impact: Math.round(impact), kind: v.kind, nodeD: Math.round(nd) });
};

// Lo stato del traffico si campiona ogni secondo e si media: una fotografia sola
// oscilla troppo per distinguere una modifica dal rumore.
const acc = { fps: 0, n: 0, stop: 0, move: 0, med: 0, libero: 0, contromano: 0, retro: 0, samples: 0 };
const why = {};
for (let i = 0; i < MEAS; i++) {
  await sleep(1);
  const ai = game.vehicles.filter((v) => v.driver === 'ai' && v.ai);
  if (!ai.length) continue;
  const sp = ai.map((v) => Math.abs(v.speed)).sort((a, b) => a - b);
  // Perché sono fermi: è la domanda che dice dove intervenire.
  for (const v of ai) if (Math.abs(v.speed) < 8) why[v.ai.why] = (why[v.ai.why] || 0) + 1;
  acc.fps += game.loop.fps;
  acc.n += ai.length;
  acc.stop += sp.filter((s) => s < 8).length;
  acc.move += sp.filter((s) => s > 25).length;
  acc.med += sp[sp.length >> 1];
  acc.libero += ai.filter((v) => Math.abs(v.speed) < 8 && v.ai.why === 'libero').length;
  acc.retro += ai.filter((v) => v.ai.recoverT > 0).length;
  // Contromano: il muso è opposto al senso di marcia della corsia assegnata.
  acc.contromano += ai.filter((v) => {
    const e = v.ai.edge;
    if (!e) return false;
    const dot = Math.cos(v.angle) * e.dx * v.ai.dir + Math.sin(v.angle) * e.dy * v.ai.dir;
    return dot < -0.35 && Math.abs(v.speed) > 20;
  }).length;
  acc.samples++;
}

const s = acc.samples || 1;
globalThis.__traffico = {
  finestra: MEAS,
  fps: +(acc.fps / s).toFixed(1),
  n: +(acc.n / s).toFixed(1),
  stop: +(acc.stop / s).toFixed(1),
  move: +(acc.move / s).toFixed(1),
  med: Math.round(acc.med / s),
  libero: +(acc.libero / s).toFixed(1),
  fermiPerche: Object.fromEntries(
    Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, +(n / s).toFixed(1)])
  ),
  retro: +(acc.retro / s).toFixed(2),
  contromano: +(acc.contromano / s).toFixed(2),
  urti: hits.length,
  urtiAlMinuto: +((hits.length * 60) / MEAS).toFixed(1),
  urtiForti: hits.filter((h) => h.impact > 90).length,
  perTipo: hits.reduce((a, h) => ((a[h.type] = (a[h.type] || 0) + 1), a), {}),
  vicinoIncrocio: hits.filter((h) => h.nodeD < 120).length,
};
