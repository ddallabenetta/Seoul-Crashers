#!/usr/bin/env node
// Guarda uno sprite generato, ingrandito, su fondo scelto.
//
// Tutta la grafica del gioco nasce da codice: l'unico modo di giudicarla è vederla
// grande. A schermo un personaggio è alto venti pixel, e un dettaglio sbagliato lì
// dentro non si vede finché non lo si ingrandisce (il protagonista è stato rifatto
// tre volte così, vedi HANDOFF §7).
//
//   node .claude/tools/sprite.mjs --expr "getHeroSprite(2,'aim')" --scale 8 --out /tmp/hero.png
//   node .claude/tools/sprite.mjs --expr "WEAPON_IDS.map(getWeaponIcon)" --scale 6 --bg '#12151a'
//
// Nell'espressione sono in scope tutti gli export di `src/render/sprites.js`, più
// `WEAPON_IDS` (l'arsenale) e `game`. Può restituire uno sprite o un array.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const { execSync } = require('node:child_process');
    return require(resolve(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright'));
  }
}

const HELP = `sprite.mjs — sprite generati, ingranditi

  --expr "..."   espressione che restituisce uno sprite o un array di sprite
                 (in scope: gli export di sprites.js, WEAPON_IDS, game)
  --scale N      ingrandimento a pixel netti (default 6)
  --cols N       colonne della griglia (default 4)
  --bg '#hex'    fondo (default #16181d)
  --out file.png dove salvare (default sprite.png nella cwd)
`;

function parseArgs(argv) {
  const o = { scale: 6, cols: 4, bg: '#16181d', out: 'sprite.png', expr: null };
  for (let i = 0; i < argv.length; i++) {
    const next = () => argv[++i];
    switch (argv[i]) {
      case '--expr': case '-e': o.expr = next(); break;
      case '--scale': o.scale = parseInt(next(), 10); break;
      case '--cols': o.cols = parseInt(next(), 10); break;
      case '--bg': o.bg = next(); break;
      case '--out': case '-o': o.out = next(); break;
      case '--help': case '-h': o.help = true; break;
      default: throw new Error(`opzione sconosciuta: ${argv[i]}`);
    }
  }
  return o;
}

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

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.help || !o.expr) { process.stdout.write(HELP); return o.expr ? 0 : 1; }

  const port = await freePort();
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', ROOT],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const stop = () => { try { server.kill('SIGTERM'); } catch { /* già morto */ } };
  process.on('exit', stop);

  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    // Basta un documento vuoto: gli sprite sono funzioni pure su canvas offscreen,
    // non serve far partire il gioco (e ci mette un decimo del tempo).
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });

    const size = await page.evaluate(async ({ expr, scale, cols, bg }) => {
      const mod = await import('/src/render/sprites.js');
      const weapons = await import('/src/entities/weapons.js');
      const scope = { ...mod, WEAPON_IDS: weapons.WEAPON_ORDER, game: window.game };
      const keys = Object.keys(scope);
      // eslint-disable-next-line no-new-func
      const fn = new Function(...keys, `return (${expr});`);
      const out = fn(...keys.map((k) => scope[k]));
      const list = Array.isArray(out) ? out : [out];

      const n = list.length;
      const c = Math.min(cols, n);
      const rows = Math.ceil(n / c);
      const cw = Math.max(...list.map((s) => s.w)) * scale + 12;
      const ch = Math.max(...list.map((s) => s.h)) * scale + 12;
      const cv = document.createElement('canvas');
      cv.id = 'spritesheet';
      cv.width = cw * c;
      cv.height = ch * rows;
      cv.style.cssText = 'position:fixed;left:0;top:0;z-index:9999';
      document.body.appendChild(cv);
      const g = cv.getContext('2d');
      g.fillStyle = bg;
      g.fillRect(0, 0, cv.width, cv.height);
      g.imageSmoothingEnabled = false;
      list.forEach((s, i) => {
        const x = (i % c) * cw;
        const y = Math.floor(i / c) * ch;
        // Scacchiera leggera dietro ogni sprite: senza, il trasparente e il fondo
        // si confondono e non si capisce dove finisce la sagoma.
        for (let a = 0; a < cw; a += 10) {
          for (let b = 0; b < ch; b += 10) {
            if (((a / 10) + (b / 10)) % 2) continue;
            g.fillStyle = 'rgba(255,255,255,0.035)';
            g.fillRect(x + a, y + b, 10, 10);
          }
        }
        g.drawImage(s.canvas, x + 6, y + 6, s.w * scale, s.h * scale);
      });
      return { w: cv.width, h: cv.height, n };
    }, { expr: o.expr, scale: o.scale, cols: o.cols, bg: o.bg });

    await page.locator('#spritesheet').screenshot({ path: resolve(process.cwd(), o.out) });
    console.error(`[sprite] ${size.n} sprite, ${size.w}x${size.h} px -> ${o.out}`);
  } finally {
    await browser.close();
    stop();
  }
  return 0;
}

main().then((c) => process.exit(c)).catch((e) => {
  console.error(`[sprite] fallito: ${e.stack || e.message}`);
  process.exit(2);
});
