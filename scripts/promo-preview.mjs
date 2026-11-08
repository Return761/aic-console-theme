/** Offline filming rehearsal. Serves only explicitly allowlisted public assets. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPalettes } from '../src/palettes.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(resolve(root, file), 'utf8');

export async function startPromoPreview({ port = 4173 } = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const base = { ...JSON.parse(await read('src/palette.json')), ...JSON.parse(await read('src/palette-extra.json')) };
  const palettes = buildPalettes(base);
  const tokens = Object.fromEntries(Object.entries(palettes).map(([key, palette]) => [key, { ...base, ...palette.tokens }]));
  const sheets = ['00-foundation', '25-hero-backdrop', '35-composer-strip', '70-run-transitions', '95-visual-review'];
  const css = (await Promise.all(sheets.map(name => read(`src/styles/${name}.css`)))).join('\n');
  // Real component implementations, with an isolated demonstration state bus.
  // This page never imports the host client, account code or authenticated APIs.
  const module = `
    const options = { titleName: 'AIC', composerStrip: true };
    const activityBus = { snapshot: { running: false, hasSession: false } };
    const subscribers = new Set();
    const subscribe = () => () => {};
    const subscribeActivity = fn => { subscribers.add(fn); return () => subscribers.delete(fn); };
    export function setPreviewRunning(value) {
      activityBus.snapshot.running = value;
      document.body.dataset.aicRunning = String(value);
      for (const fn of subscribers) fn();
    }
    ${await read('src/hero-dotfield-gpu.js')}
    ${await read('src/hero-dotfield.js')}
    ${await read('src/composer-strip.js')}
    export { installHeroDotfield, installComposerStrip };
  `;
  const files = new Map([
    ['/', ['tools/promo/index.html', 'text/html; charset=utf-8']],
    ['/preview.css', ['tools/promo/preview.css', 'text/css; charset=utf-8']],
    ['/preview.js', ['tools/promo/preview.js', 'text/javascript; charset=utf-8']],
    ['/icon.svg', ['icon.svg', 'image/svg+xml']],
    ...['HarmonyOS_Sans_SC_Regular.ttf', 'HarmonyOS_Sans_SC_Bold.ttf', 'JetBrainsMono-Regular.ttf', 'Rajdhani-SemiBold.ttf'].map(name => [`/fonts/${name}`, [`assets/fonts/${name}`, 'font/ttf']]),
  ]);
  const generated = new Map([
    ['/theme.css', [css, 'text/css; charset=utf-8']],
    ['/components.js', [module, 'text/javascript; charset=utf-8']],
    ['/tokens.json', [JSON.stringify(tokens), 'application/json']],
  ]);
  const server = createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const path = new URL(request.url, 'http://localhost').pathname;
      const dynamic = generated.get(path), file = files.get(path);
      if (!dynamic && !file) { response.writeHead(404); response.end('Not found'); return; }
      const [data, type] = dynamic || [await readFile(resolve(root, file[0])), file[1]];
      response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(request.method === 'HEAD' ? undefined : data);
    } catch { response.writeHead(500); response.end('Preview asset unavailable'); }
  });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', done); });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const portArg = process.argv.indexOf('--port');
  const { server, url } = await startPromoPreview({ port: portArg < 0 ? 4173 : Number(process.argv[portArg + 1]) });
  console.log(`AIC filming rehearsal: ${url}\nOffline visual demonstration; no host account or Agent is connected.\nCtrl+C to stop.`);
  process.once('SIGINT', () => server.close());
}
