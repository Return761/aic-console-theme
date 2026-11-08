/** Reproducible, sanitised rehearsal stills. Does not connect to DSH. */
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startPromoPreview } from './promo-preview.mjs';

const output = resolve('.artifacts/promo');
await mkdir(output, { recursive: true });
const executablePath = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find(path => path && existsSync(path));
if (!executablePath) throw new Error('Set CHROME_PATH to an installed Chromium browser.');
const { server, url } = await startPromoPreview({ port: 0 });
let browser;
const expect = (value, message) => { if (!value) throw new Error(message); };
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const errors = [], externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (!request.url().startsWith(url)) externalRequests.push(request.url()); });
  await page.goto(url);
  await page.waitForSelector('body[data-promo-ready="true"]');
  const routes = {};
  for (const path of ['/.git/config', '/.artifacts/github-publication.json', '/src/account.js', '/unknown']) {
    routes[path] = (await page.request.get(new URL(path, url).href)).status();
    expect(routes[path] === 404, `Unexpected preview route: ${path}`);
  }
  await page.keyboard.press('h');
  const cases = [];
  for (const mode of ['dark', 'light']) {
    for (const scheme of ['teal', 'oxide', 'ultraviolet']) {
      await page.keyboard.press(mode === 'dark' ? '1' : '2');
      await page.waitForTimeout(200);
      const metrics = await page.evaluate(() => {
        const track = document.querySelector('.aic-composer-strip-track');
        const diamond = document.querySelector('.aic-hero-dotfield');
        const title = document.querySelector('.aic-composer-strip-title');
        const mark = getComputedStyle(title, '::before');
        return {
          scheme: document.body.dataset.aicScheme,
          dark: document.body.hasAttribute('data-ds-dark-theme'),
          height: track.getBoundingClientRect().height, radius: getComputedStyle(track).borderRadius,
          source: getComputedStyle(track, '::before').backgroundImage,
          canvasWidth: diamond.width, canvasHeight: diamond.height,
          markShadow: mark.boxShadow, markBackground: mark.backgroundColor,
          fonts: ['400 16px "HarmonyOS Sans SC"', '600 18px Rajdhani', '400 10px "JetBrains Mono"'].every(font => document.fonts.check(font)),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(metrics.scheme === scheme && metrics.dark === (mode === 'dark'), 'Palette cycle mismatch');
      expect(metrics.height === 8 && metrics.radius === '0px' && metrics.source.includes('radial-gradient'), 'Invalid silver track');
      expect(metrics.canvasWidth >= 1920 && metrics.canvasHeight >= 1080, 'Hero canvas is missing');
      expect(metrics.markShadow === 'none' && metrics.markBackground === 'rgba(0, 0, 0, 0)', 'Diamond must stay hollow without glow');
      expect(metrics.fonts && !metrics.overflow, 'Fonts or layout not ready');
      const file = `${mode}-${scheme}.png`;
      await page.screenshot({ path: resolve(output, file) });
      cases.push({ file, ...metrics });
      await page.keyboard.press('p');
    }
    await page.keyboard.press('l');
  }
  await page.keyboard.press('4');
  const idle = await page.locator('.aic-run-bar').evaluate(node => getComputedStyle(node).getPropertyValue('--aic-edge-color').trim());
  await page.keyboard.press('r');
  const running = await page.locator('.aic-run-bar').evaluate(node => ({ color: getComputedStyle(node).getPropertyValue('--aic-edge-color').trim(), primary: getComputedStyle(node).getPropertyValue('--aic-system').trim() }));
  expect(idle.toLowerCase() === '#969696' && running.color === running.primary, 'Invalid run light source');
  await page.screenshot({ path: resolve(output, 'run-preview.png') });
  await page.keyboard.press('r');
  await page.keyboard.press('1');
  await page.mouse.move(1550, 420);
  await page.waitForTimeout(350);
  const parallax = await page.locator('.aic-hero-dotfield').getAttribute('data-parallax-x');
  expect(Number(parallax) > 0, 'Hero parallax did not react');
  await page.mouse.click(450, 480);
  await page.waitForTimeout(100);
  expect(Number(await page.locator('.aic-hero-dotfield').getAttribute('data-ripple-count')) > 0, 'Ripple did not react');
  await page.keyboard.press('5');
  await page.screenshot({ path: resolve(output, 'outro.png') });
  expect(errors.length === 0 && externalRequests.length === 0, 'Browser errors or external asset requests');

  const images = await Promise.all(cases.map(async item => ({ label: `${item.dark ? 'DARK' : 'LIGHT'} / ${item.scheme.toUpperCase()}`, data: (await readFile(resolve(output, item.file))).toString('base64') })));
  const sheet = await browser.newPage({ viewport: { width: 1920, height: 792 }, deviceScaleFactor: 1 });
  await sheet.setContent(`<html><body style="margin:0;background:#111313;display:grid;grid-template-columns:repeat(3,640px);color:#EAEBEA;font:12px monospace">${images.map(image => `<div><div style="height:36px;display:flex;align-items:center;padding-left:18px;box-sizing:border-box">${image.label} / VISUAL DEMONSTRATION</div><img style="display:block;width:640px;height:360px" src="data:image/png;base64,${image.data}"></div>`).join('')}</body></html>`);
  await sheet.screenshot({ path: resolve(output, 'contact-sheet.png') });
  const report = { viewport: '1920x1080', cases, idle, running, parallax: Number(parallax), ripple: true, routes, browserErrors: errors, externalRequests };
  await writeFile(resolve(output, 'verification.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, paletteCases: cases.length, browserErrors: errors.length, externalRequests: externalRequests.length, privacyRoutes: '404', interaction: 'parallax + ripple + primary run light verified' }));
} finally {
  await browser?.close();
  await new Promise(done => server.close(done));
}
