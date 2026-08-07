#!/usr/bin/env node
// Hook PostToolUse su Write/Edit: due controlli che costano 40 ms e fanno risparmiare
// un giro completo di browser.
//
// 1. **Sintassi.** Il gioco non ha build step: un errore di sintassi non lo scopre
//    nessuno finché la pagina non parte, e lì si presenta come "schermata di
//    caricamento ferma", che è il sintomo più costoso da diagnosticare.
// 2. **Determinismo della generazione.** Toccare i file che generano la città può
//    spostare l'ordine di consumo dell'rng: la Seoul collaudata cambia tutta, e il
//    conteggio di edifici/isolati non torna più. Non è un errore — a volte è voluto —
//    ma va saputo *mentre* lo si fa, non tre modifiche dopo.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// I file la cui modifica può ridisegnare la città (vedi HANDOFF, "Determinismo").
const GEN_FILES = ['world/citygen.js', 'world/districts.js', 'world/roadgraph.js'];

let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let file = '';
  try {
    const input = JSON.parse(raw || '{}');
    file = input.tool_response?.filePath || input.tool_input?.file_path || '';
  } catch {
    process.exit(0); // payload illeggibile: non è un motivo per bloccare nessuno
  }
  if (!file.endsWith('.js') && !file.endsWith('.mjs')) process.exit(0);

  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const msg = (err.stderr || Buffer.from('')).toString().split('\n').slice(0, 12).join('\n');
    console.error(`Errore di sintassi in ${file} — il gioco non partirebbe:\n${msg}`);
    process.exit(2); // blocca e rimanda il messaggio al modello
  }

  const notes = [];
  if (GEN_FILES.some((g) => file.endsWith(g))) {
    notes.push(
      'Hai toccato la generazione della città: se hai aggiunto, tolto o spostato una '
      + 'chiamata a `rng.*` la Seoul collaudata cambia tutta. Verifica con '
      + '`node .claude/tools/probe.mjs --eval "game.city.stats"` — attesi '
      + 'buildings 418, props 1299, blocks 122, nodes 196, edges 279, doglegs 4, stairs 3 '
      + '(shops 114, venues 325, garages 7, turfs 6 hanno un rng loro e non seguono la città).'
    );
  }
  if (file.endsWith('render/ground.js') || file.endsWith('world/citygen.js')) {
    notes.push('Se hai cambiato il disegno del terreno, invalida la cache dei tile: `game.scene.ground.tiles.clear()`.');
  }
  // `Math.random()` in generazione romperebbe il determinismo della seed.
  if (GEN_FILES.some((g) => file.endsWith(g))) {
    try {
      const src = readFileSync(file, 'utf8');
      if (/Math\.random\(/.test(src)) {
        notes.push('Attenzione: `Math.random()` in un file di generazione. In generazione si usa solo `rng` (la seed deve dare sempre la stessa città).');
      }
    } catch { /* già segnalato altrove */ }
  }

  if (notes.length) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: notes.join('\n') },
      suppressOutput: true,
    }));
  }
  process.exit(0);
});
