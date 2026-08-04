#!/usr/bin/env node
// Avvia Seoul Crashers in un Chromium headless, aspetta il boot, esegue quello che
// gli chiedi dentro la pagina e riporta il risultato. È il modo in cui un agente
// "gioca" al gioco senza avere uno schermo: senza questo, l'unica verifica possibile
// sarebbe rileggere il codice, che è esattamente come sono passati i bug delle fasi
// precedenti (invisibili nel sorgente, ovvi a schermo).
//
//   node .claude/tools/probe.mjs --seconds 6 --eval "game.loop.fps" --shot /tmp/a.png
//   node .claude/tools/probe.mjs --script .claude/tools/scenes/wanted5.js --seconds 8
//
// Esce con codice 1 se la pagina ha sollevato un errore JS o loggato un console.error:
// va bene come check da CI o da hook.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    // playwright è installato globalmente in questo ambiente: NODE_PATH non è
    // impostato di default, quindi lo risolviamo a mano.
    const { execSync } = require('node:child_process');
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return require(resolve(globalRoot, 'playwright'));
  }
}

function parseArgs(argv) {
  const opts = { seconds: 3, evals: [], scripts: [], size: '1280x720', port: 0, shot: null, quiet: false, boot: 45 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case '--seconds': case '-s': opts.seconds = parseFloat(next()); break;
      case '--eval': case '-e': opts.evals.push(next()); break;
      case '--script': opts.scripts.push(next()); break;
      case '--shot': opts.shot = next(); break;
      case '--clip': opts.clip = next().split(',').map(Number); break;
      case '--zoom': opts.zoom = parseFloat(next()); break;
      case '--size': opts.size = next(); break;
      case '--port': opts.port = parseInt(next(), 10); break;
      case '--boot-timeout': opts.boot = parseFloat(next()); break;
      case '--quiet': case '-q': opts.quiet = true; break;
      case '--help': case '-h': opts.help = true; break;
      default: throw new Error(`opzione sconosciuta: ${a}`);
    }
  }
  return opts;
}

const HELP = `probe.mjs — avvia il gioco headless e lo interroga

  --seconds N        secondi di gioco prima di valutare (default 3)
  --eval "expr"      espressione valutata nella pagina (ripetibile); "game" è in scope
  --script file.js   file iniettato come corpo di funzione async prima degli --eval
                     (ripetibile): serve a preparare la scena — armi, stelle, teletrasporti
  --shot out.png     screenshot a fine corsa
  --clip x,y,w,h     ritaglia lo screenshot (per guardare un angolo dell'HUD)
  --zoom N           fattore del device pixel ratio: 2 raddoppia i pixel dello scatto
  --size WxH         viewport (default 1280x720)
  --port N           porta del server statico (default: una libera)
  --boot-timeout N   secondi massimi di attesa del boot (default 45)
  --quiet            stampa solo i risultati degli --eval
`;

/** Porta libera scelta dal sistema: due probe in parallelo non si pestano i piedi. */
function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

async function waitForServer(port, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/index.html`);
      if (r.ok) return true;
    } catch { /* non ancora su */ }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error('il server statico non è partito');
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) { process.stdout.write(HELP); return 0; }

  const port = opts.port || (await freePort());
  const [vw, vh] = opts.size.split('x').map((n) => parseInt(n, 10));
  const log = (...a) => { if (!opts.quiet) console.error(...a); };

  // Server statico: i moduli ES non si caricano da file://
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', ROOT], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  const stopServer = () => { try { server.kill('SIGTERM'); } catch { /* già morto */ } };
  process.on('exit', stopServer);

  const { chromium } = loadPlaywright();
  let browser;
  const problems = [];
  try {
    await waitForServer(port);
    browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: opts.zoom || 1 });

    page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
      else if (!opts.quiet && msg.type() === 'warning') log(`[warn] ${msg.text()}`);
    });

    // Niente cache: è la trappola numero uno del progetto (vedi HANDOFF §1).
    await page.route('**/*', (route) => route.continue());
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });

    log(`[probe] boot… (porta ${port})`);
    await page.waitForFunction(() => window.game && window.game.loop && window.game.city, null,
      { timeout: opts.boot * 1000 });
    log('[probe] boot ok');

    if (opts.seconds > 0) await page.waitForTimeout(opts.seconds * 1000);

    for (const file of opts.scripts) {
      const src = readFileSync(resolve(process.cwd(), file), 'utf8');
      const out = await page.evaluate(
        // eslint-disable-next-line no-new-func
        async (code) => {
          const game = window.game;
          const fn = new Function('game', `return (async () => { ${code} })();`);
          const r = await fn(game);
          return r === undefined ? null : r;
        },
        src
      );
      if (out !== null) console.log(JSON.stringify(out, null, 2));
      log(`[probe] script ${file} eseguito`);
    }

    for (const expr of opts.evals) {
      const out = await page.evaluate(
        async (code) => {
          const game = window.game;
          const fn = new Function('game', `return (async () => (${code}))();`);
          const value = await fn(game);
          // Set e Map non sopravvivono a JSON.stringify: li rendiamo leggibili.
          return JSON.parse(JSON.stringify(value, (k, v) => {
            if (v instanceof Set) return [...v];
            if (v instanceof Map) return Object.fromEntries(v);
            return v === Infinity ? '∞' : v;
          }));
        },
        expr
      );
      console.log(JSON.stringify(out));
    }

    if (opts.shot) {
      const clip = opts.clip
        ? { x: opts.clip[0], y: opts.clip[1], width: opts.clip[2], height: opts.clip[3] }
        : undefined;
      await page.screenshot({ path: resolve(process.cwd(), opts.shot), clip });
      log(`[probe] screenshot in ${opts.shot}`);
    }
  } finally {
    if (browser) await browser.close();
    stopServer();
  }

  if (problems.length) {
    console.error(`\n[probe] ${problems.length} errori nella pagina:`);
    for (const p of problems.slice(0, 20)) console.error(`  - ${p}`);
    return 1;
  }
  log('[probe] nessun errore in console');
  return 0;
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(`[probe] fallito: ${err.stack || err.message}`);
  process.exit(2);
});
