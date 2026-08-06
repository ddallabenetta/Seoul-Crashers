#!/usr/bin/env node
// Hook SessionStart: mette in testa alla sessione le tre cose che un agente nuovo
// non può indovinare dal codice — dove sta lo stato del progetto, come si verifica
// una modifica davvero (headless, non "a occhio sul sorgente"), e quali sono gli
// errori che in questo repo si ripetono.
//
// Volutamente corto: un briefing lungo viene ignorato come il rumore.
import { execFileSync } from 'node:child_process';

function has(cmd, args) {
  try { execFileSync(cmd, args, { stdio: 'pipe' }); return true; } catch { return false; }
}

const tools = [];
tools.push(has('python3', ['--version']) ? 'python3 ok' : 'python3 MANCA (serve al server statico)');
let pw = false;
try {
  const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  pw = has('node', ['-e', `require('${root.replace(/\\/g, '/')}/playwright')`]);
} catch { /* niente npm: lo diciamo sotto */ }
tools.push(pw ? 'playwright ok' : 'playwright MANCA (probe.mjs e sprite.mjs non funzioneranno)');

const brief = `Seoul Crashers — briefing di sessione

- **HANDOFF.md è l'indice** (~130 righe): stato del progetto e tabella di cosa sta dove.
  Leggilo prima di toccare src/, poi apri da docs/ **solo** il documento che ti serve —
  verifica, architettura, trappole, parametri, backlog, strumenti, storico. Non caricarli
  tutti: sono ~2400 righe. I rimandi §N si risolvono con la tabella dentro HANDOFF.md.
- Vincoli non negoziabili: zero dipendenze, nessun build step, nessun asset esterno (tutta la
  grafica è generata da codice), commenti in italiano e solo dove spiegano un *perché*.
- **Verifica nel browser, non nel sorgente.** Diversi bug di questo progetto erano invisibili
  nel codice e ovvi a schermo:
    node .claude/tools/probe.mjs --seconds 5 --eval "game.city.stats" --shot /tmp/a.png
    node .claude/tools/sprite.mjs --expr "getHeroSprite(2,'aim')" --scale 8 --out /tmp/h.png
  Le skill /seoul-verifica, /seoul-arma e /seoul-sprite spiegano quando e come.
- Toolchain: ${tools.join(' · ')}`;

process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: brief },
  suppressOutput: true,
}));
