import { installHeroDotfield, installComposerStrip, setPreviewRunning } from '/components.js';

const tokens = await fetch('/tokens.json').then(response => response.json());
const schemes = ['teal', 'oxide', 'ultraviolet'];
const names = ['青绿 / 砂金', '赤红 / 砂金', '灰紫 / 冰蓝'];
const scenes = {
  hero: ['01 / ENGINEERING CANVAS', '让界面，进入秩序。', '半透明空心菱形 · 四边刻度 · 鼠标视差'],
  input: ['02 / INPUT IN MOTION', '从一个想法开始。', '8px 银色流动光条 · 自定义标题'],
  palette: ['03 / THREE PALETTES', '三种色彩，同一种秩序。', '中性面板保持一致 · 次级色只作标识'],
  run: ['04 / PRIMARY LIGHT', '让状态，有光可循。', '待机灰色 · 运行跟随第一主题色'],
  outro: ['AIC / DSH NEXT THEME', '为你的工作台，建立秩序。', '现已公开 · 本地安装'],
};
let scheme = 0, mode = 'dark', running = false;
function applyPalette() {
  for (const [key, value] of Object.entries(tokens[schemes[scheme]])) document.body.style.setProperty(key, value[mode]);
  document.body.toggleAttribute('data-ds-dark-theme', mode === 'dark');
  document.body.dataset.aicScheme = schemes[scheme];
  document.querySelectorAll('.film-palette span').forEach((node, index) => node.toggleAttribute('data-active', index === scheme));
  updateState();
}
function updateState() {
  document.querySelector('.film-state').textContent = `${names[scheme]} · ${mode === 'dark' ? '深色' : '浅色'} · ${running ? '运行光带预览 / 未连接 Agent' : '待机 / 未连接 Agent'}`;
}
function setScene(name) {
  if (!scenes[name]) return;
  document.body.dataset.scene = name;
  const [kicker, title, description] = scenes[name];
  document.querySelector('.film-kicker').textContent = kicker;
  document.querySelector('h1').textContent = title;
  document.querySelector('.film-description').textContent = description;
  document.querySelectorAll('[data-scene-button]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.sceneButton === name)));
}
const actions = {
  palette() { scheme = (scheme + 1) % schemes.length; applyPalette(); },
  mode() { mode = mode === 'dark' ? 'light' : 'dark'; applyPalette(); },
  running() { running = !running; setPreviewRunning(running); updateState(); },
  motion() { document.body.dataset.aicMotion = document.body.dataset.aicMotion === 'off' ? 'on' : 'off'; },
  hide() { const controls = document.querySelector('.film-controls'); controls.hidden = !controls.hidden; },
  async fullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); },
};
applyPalette();
setScene('hero');
const disposeHero = installHeroDotfield(), disposeStrip = installComposerStrip();
document.querySelectorAll('[data-scene-button]').forEach(button => button.addEventListener('click', () => setScene(button.dataset.sceneButton)));
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => actions[button.dataset.action]()));
document.addEventListener('keydown', event => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  const key = event.key.toLowerCase();
  if (/^[1-5]$/.test(key)) setScene(Object.keys(scenes)[Number(key) - 1]);
  else { const action = { p: 'palette', l: 'mode', r: 'running', m: 'motion', h: 'hide', f: 'fullscreen' }[key]; if (action) actions[action](); }
});
window.addEventListener('pagehide', () => { disposeHero(); disposeStrip(); }, { once: true });
await document.fonts.ready;
document.body.dataset.promoReady = 'true';
