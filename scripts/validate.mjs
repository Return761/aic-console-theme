import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(resolve(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const expect = (condition, message) => { if (!condition) throw new Error(message); };
expect(pkg.exports['./client'] === './client.js', 'Missing client export');
expect(pkg.exports['./package.json'] === './package.json', 'Missing manifest export');
expect(pkg.dsh.client.platform === 'web' && pkg.dsh.client.immediately, 'Invalid client activation');
expect(pkg.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-conversation'), 'Conversation slots must load before this theme');
for (const file of ['client.js', 'index.js', 'icon.svg', 'cordis.patch.yml']) expect(existsSync(resolve(root, file)), `Missing runtime asset: ${file}`);
new vm.Script(read('client.js'), { filename: 'client.js' });
new vm.Script(read('index.js').replace(/^export\s+/gm, ''), { filename: 'index.js' });

const zh = JSON.parse(read('locale/zh.json'));
const en = JSON.parse(read('locale/en.json'));
expect(zh.meta.title && en.meta.title, 'Missing plugin title');
expect(JSON.stringify(Object.keys(zh.ui).sort()) === JSON.stringify(Object.keys(en.ui).sort()), 'Locale key sets differ');
for (const [lang, dictionary] of [['zh', zh.ui], ['en', en.ui]]) {
  for (const [key, value] of Object.entries(dictionary)) expect(typeof value === 'string' && value.trim(), `${lang}: empty ${key}`);
}

const tokens = { ...JSON.parse(read('src/palette.json')), ...JSON.parse(read('src/palette-extra.json')) };
for (const [name, modes] of Object.entries(tokens)) {
  expect(/^--dsw-(alias|specific)-[a-z0-9-]+$/.test(name), `Invalid token name: ${name}`);
  for (const mode of ['light', 'dark']) expect(/^#(?:[\da-f]{6}|[\da-f]{8})$/i.test(modes[mode]), `Invalid ${mode} value for ${name}`);
}

const shipped = resolve(process.env.DSH_APP_DIR ?? 'C:/Program Files/dsh-esktop/DSH Desktop/resources/app', 'node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js');
if (existsSync(shipped)) {
  const known = new Set([...readFileSync(shipped, 'utf8').matchAll(/(--dsw-(?:alias|specific)-[a-z0-9-]+):/g)].map(match => match[1]));
  expect(known.size > 50, 'Cannot locate shipped theme aliases; update the inspection adapter');
  for (const token of Object.keys(tokens)) expect(known.has(token), `Unknown host token: ${token}`);
  console.log(`Verified ${Object.keys(tokens).length} overrides against the installed host.`);
} else console.log('Host token verification skipped: set DSH_APP_DIR to an installed application.');

for (const file of readdirSync(resolve(root, 'src/styles')).filter(name => name.endsWith('.css'))) {
  const css = read(`src/styles/${file}`);
  expect(css.includes('body[data-aic-theme]'), `${file}: missing lifecycle gate`);
}
const icon = read('icon.svg');
expect(icon.includes('xmlns="http://www.w3.org/2000/svg"') && icon.includes('viewBox="0 0 264 264"'), 'Invalid icon root');
console.log('Manifest, syntax, translations and theme assets are valid.');
