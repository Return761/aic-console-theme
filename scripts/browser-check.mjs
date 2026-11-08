/** Live, read-only host integration check. No messages or model changes are submitted. */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const url = process.env.DSH_WEB_URL;
if (!url) throw new Error('Set DSH_WEB_URL to the current authenticated local DSH URL. It will not be saved.');
// Optional: reuse an existing signed browser session instead of a launch URL token.
const storedCookie = process.env.DSH_WEB_COOKIE ? JSON.parse(process.env.DSH_WEB_COOKIE) : null;
const executablePath = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].find(candidate => candidate && existsSync(candidate));
if (!executablePath) throw new Error('Set CHROME_PATH to a Chromium-based browser.');
const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', colorScheme: 'dark' });
if (storedCookie) await context.addCookies([{ name: storedCookie.name, value: storedCookie.value, domain: new URL(url).hostname, path: storedCookie.path || '/', httpOnly: true, secure: false }]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const expect = (value, message) => { if (!value) throw new Error(message); };
const output = resolve('.artifacts');
await mkdir(output, { recursive: true });
try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('body[data-aic-theme]').waitFor();
  await page.waitForFunction(() => !document.querySelector('.aic-boot'), null, { timeout: 8000 });
  const stream=await page.locator('.aic-composer-strip-track').evaluate(n=>({height:n.getBoundingClientRect().height,radius:getComputedStyle(n).borderRadius,light:getComputedStyle(n,'::before').backgroundImage}));
  expect(stream.height===8&&stream.radius==='0px'&&stream.light.includes('radial-gradient'),'Composer stream must be an 8px square-ended channel with a local silver light source');
  const chrome = await page.evaluate(() => {
    const shortcut = document.querySelector('[data-slot="sidebar"] [class*="_newSessionShortcut"]');
    const newSession = document.querySelector('[data-slot="sidebar"] [class*="_newSession"]');
    const runBar = document.querySelector('.aic-run-bar');
    const label = document.querySelector('[data-slot="sidebar.workspaces"] [class*="_sectionLabel"]');
    const folder = document.querySelector('[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"] [class*="_projectText"]');
    const folderMark = folder ? getComputedStyle(folder, '::before') : null;
    return {
      shortcutHidden: !shortcut || getComputedStyle(shortcut).display === 'none',
      newSessionHeight: newSession ? Math.round(newSession.getBoundingClientRect().height) : null,
      runBar: runBar ? { width: Math.round(runBar.getBoundingClientRect().width), viewport: innerWidth } : null,
      counters: label ? label.getAttribute('data-aic-counters') : null,
      folderDiamond: folderMark ? { background: folderMark.backgroundColor, shadow: folderMark.boxShadow, width: folderMark.width, height: folderMark.height } : null,
    };
  });
  const visuals = await page.evaluate(() => {
    const frame = document.querySelector('[data-slot="conversation.view"] [class*="_frame"]');
    const header = document.querySelector('.aic-header-telemetry');
    const bar = document.querySelector('.aic-run-bar');
    const rail = document.querySelector('[data-slot="conversation.view"] nav:has(> [class*="_scroller"] > [class*="_marks"])');
    const current = rail ? rail.querySelector('button[data-index][aria-current="true"]') : null;
    const triangle = current ? getComputedStyle(current, '::before') : null;
    return {
      grid: frame ? getComputedStyle(frame).backgroundImage : '',
      header: header ? header.innerText.slice(0, 120) : null,
      idleLight: bar ? { running: document.body.dataset.aicRunning === 'true', shadow: getComputedStyle(bar).boxShadow, cores: bar.children.length,emissionHeight:parseFloat(getComputedStyle(bar,'::before').height),emission:getComputedStyle(bar,'::before').backgroundImage } : null,
      railTriangle: triangle ? { border: triangle.borderInlineStartWidth, width: triangle.width } : null,
    };
  });
  expect(visuals.idleLight !== null && visuals.idleLight.cores === 0, 'Corner glow cores must not be rendered');
  expect(visuals.idleLight.shadow === 'none', 'Bottom light must not use an unbounded outer shadow');
  expect(visuals.idleLight.emissionHeight >= 60 && visuals.idleLight.emission.includes('to top'), 'Bottom edge emission is missing or has no upward source');
  const lightStates=await page.evaluate(()=>{
    const original=document.body.getAttribute('data-aic-running');
    const bar=document.querySelector('.aic-run-bar');
    const read=()=>({source:getComputedStyle(bar).getPropertyValue('--aic-edge-color').trim(),primary:getComputedStyle(bar).getPropertyValue('--aic-system').trim(),bloom:getComputedStyle(bar,'::before').backgroundImage,height:parseFloat(getComputedStyle(bar,'::before').height)});
    try {document.body.dataset.aicRunning='false';const idle=read();document.body.dataset.aicRunning='true';return{idle,running:read()};}
    finally {if(original===null)document.body.removeAttribute('data-aic-running');else document.body.setAttribute('data-aic-running',original);}
  });
  expect(lightStates.idle.source.toLowerCase()==='#969696','Idle light must be neutral grey');
  expect(lightStates.running.source.toLowerCase()===lightStates.running.primary.toLowerCase(),'Running light must follow the primary theme colour');
  expect(lightStates.running.height>lightStates.idle.height && lightStates.running.bloom.includes('34%'),'Running bloom must decay away from the narrow source');
  expect(chrome.shortcutHidden, 'New session shortcut must not overlap the label');
  expect(chrome.newSessionHeight === 34, 'New session control must keep its 34px row');
  expect(chrome.runBar !== null && Math.abs(chrome.runBar.width - chrome.runBar.viewport) <= 2, 'Run bar must span the frame');
  expect(/^\d+W \/ \d+S$/.test(chrome.counters ?? ''), `Sidebar counters missing: ${chrome.counters}`);
  expect(chrome.folderDiamond !== null && chrome.folderDiamond.background === 'rgba(0, 0, 0, 0)' && chrome.folderDiamond.shadow === 'none' && chrome.folderDiamond.width === chrome.folderDiamond.height, 'Project diamonds must be hollow and without glow');
  const hero=page.locator('[data-content-phase="hero"]');
  const newSessionBackdrop=await hero.count()>0;
  if(newSessionBackdrop){
    const field=page.locator('.aic-hero-dotfield');
    await field.waitFor();
    await page.waitForFunction(()=>document.querySelector('.aic-hero-dotfield')?.dataset.layerCount>0);
    const sample=()=>field.evaluate(n=>{const gl=n.dataset.renderStrategy==='gpu-mask'?n.getContext('webgl2'):null;let data;if(gl){data=new Uint8Array(n.width*n.height*4);gl.readPixels(0,0,n.width,n.height,gl.RGBA,gl.UNSIGNED_BYTE,data);}else data=n.getContext('2d').getImageData(0,0,n.width,n.height).data;let alpha=0,painted=0,neutral=true,centerAlpha=0;for(let i=0;i<data.length;i+=4){alpha+=data[i+3];if(data[i+3]){painted++;if(data[i]!==data[i+1]||data[i]!==data[i+2])neutral=false;}}for(let y=Math.floor(n.height/2)-30;y<Math.floor(n.height/2)+30;y++)for(let x=Math.floor(n.width/2)-30;x<Math.floor(n.width/2)+30;x++)centerAlpha+=data[(y*n.width+x)*4+3];return{alpha,painted,neutral,centerAlpha,shape:n.dataset.shape,nodeShape:n.dataset.nodeShape,layers:Number(n.dataset.layerCount),scale:n.width/n.getBoundingClientRect().width,pointer:getComputedStyle(n).pointerEvents};});
    const initial=await sample();
    expect(initial.neutral&&initial.painted>1000&&initial.scale>=2&&initial.pointer==='none','Diamond must be neutral, antialiased and click-through');
    expect(initial.shape==='layered-hollow-diamond'&&initial.nodeShape==='continuous'&&initial.layers===4&&initial.centerAlpha===0,'Engineering diamond must have four continuous translucent layers and a hollow centre');
    const sheet=await page.evaluate(()=>{
      const plate=document.querySelector('.aic-hero-plate'),hero=document.querySelector('[data-content-phase="hero"]');
      if(!plate||!hero) return null;
      const r=plate.getBoundingClientRect(),f=hero.getBoundingClientRect(),s=getComputedStyle(plate);
      return {text:plate.innerText,cells:[...plate.querySelectorAll('span')].map(n=>n.textContent),rect:[r.x,r.y,r.width,r.height],frame:[f.x,f.y,f.width,f.height],pointer:s.pointerEvents,font:s.fontFamily,
        guides:[...document.querySelectorAll('.aic-hero-guide')].map(n=>{const g=n.getBoundingClientRect();return {height:g.height,pointer:getComputedStyle(n).pointerEvents};})};
    });
    expect(sheet&&sheet.cells.length===5&&sheet.cells[0].endsWith('/ NEW SESSION'),'Sheet title block is missing');
    expect(sheet&&['SHEET 01 / 01','GRID 96 / 48','SCALE 1:1','ORIGIN 0 / 0'].every(value=>sheet.cells.includes(value)),'Sheet title block fields are incomplete');
    expect(sheet.pointer==='none'&&sheet.font.startsWith('"JetBrains Mono"'),'Sheet title block must be click-through mono annotations');
    expect(sheet.rect[0]>=sheet.frame[0]+50&&sheet.rect[0]+sheet.rect[2]<=sheet.frame[0]+sheet.frame[2]-40&&sheet.rect[1]+sheet.rect[3]<=sheet.frame[1]+sheet.frame[3]-36,'Sheet title block escaped the drawing frame');
    expect(sheet.guides.length===2&&sheet.guides.every(guide=>guide.height>20&&guide.pointer==='none'),'Construction witness lines are missing or clickable');
    const fieldBox=await field.boundingBox();
    await page.mouse.click(fieldBox.x+fieldBox.width*.14,fieldBox.y+fieldBox.height*.17);
    await page.waitForTimeout(220);
    const ripple=await sample();
    expect(ripple.neutral&&ripple.alpha!==initial.alpha,'Click must propagate a visible neutral ripple');
    for(let i=0;i<8;i++)await page.mouse.click(fieldBox.x+30+i*16,fieldBox.y+120);
    await page.waitForTimeout(50);
    expect(Number(await field.getAttribute('data-ripple-count'))<=6,'Rapid clicks create an unbounded ripple queue');
    await page.locator('body').evaluate(n=>n.dataset.aicMotion='off');
    await page.waitForFunction(()=>document.querySelector('.aic-hero-dotfield')?.dataset.fieldState==='static');
    const stopped=await sample();
    await page.mouse.click(fieldBox.x+80,fieldBox.y+130);
    await page.waitForTimeout(100);
    expect((await sample()).alpha===stopped.alpha,'Motion-off must keep the static diamond');
    await page.locator('body').evaluate(n=>n.dataset.aicMotion='on');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.mouse.click(fieldBox.x+80,fieldBox.y+130);
    expect(await field.getAttribute('data-field-state')==='static','Reduced motion must suppress ripples');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('body').evaluate(n=>n.dataset.aicDecoration='off');
    await field.waitFor({state:'detached'});
    expect(await page.locator('.aic-hero-plate').count()===0&&await page.locator('.aic-hero-guide').count()===0,'Sheet annotations survived decoration off');
    await page.locator('body').evaluate(n=>n.dataset.aicDecoration='on');
    await field.waitFor();
    expect(await page.locator('.aic-hero-plate').count()===1&&await page.locator('.aic-hero-guide').count()===2,'Sheet annotations were not restored');
    expect(await field.count()===1,'Toggling decoration duplicates the backdrop canvas');
    expect(await hero.locator('.aic-hero-axis').count()===4,'Four mirrored viewport rulers are missing');
    await page.mouse.move(fieldBox.x+fieldBox.width*.8,fieldBox.y+fieldBox.height*.25);
    await page.waitForFunction(()=>Number(document.querySelector('.aic-hero-dotfield')?.dataset.parallaxX)>5);
    const cursor=await hero.locator('.aic-hero-rulers').evaluate(n=>({x:Number(n.dataset.cursorX),y:Number(n.dataset.cursorY)}));
    expect(cursor.x>50&&cursor.y<50,'Ruler indicators do not follow pointer coordinates');
    await page.mouse.move(0,0);
    await page.waitForFunction(()=>document.querySelector('.aic-hero-dotfield')?.dataset.parallaxX==='0');
  }
  await page.getByRole('button', { name: 'AIC 主题设置', exact: true }).click();
  // Exercise the persisted loading gate and consume the input above the host UI.
  const featureSettings=page.getByRole('dialog');
  await featureSettings.getByLabel('标题名称',{exact:false}).fill('ORION');
  expect(await page.locator('.aic-brand-name').innerText()==='ORION','Brand did not use the configured title');
  expect(await page.locator('.aic-composer-strip-title').innerText()==='ORION','Composer did not use the configured title');
  if(newSessionBackdrop) expect(await page.locator('.aic-hero-plate-title').innerText()==='ORION / NEW SESSION','Sheet plate did not use the configured title');
  await featureSettings.getByLabel('输入栏顶部流动条',{exact:false}).uncheck();
  expect(await page.locator('.aic-composer-strip').count()===0,'Composer strip toggle did not remove the row');
  await featureSettings.getByLabel('输入栏顶部流动条',{exact:false}).check();
  const rail=await page.evaluate(()=>{const strip=document.querySelector('.aic-composer-strip');if(!strip)return null;const track=strip.querySelector('.aic-composer-strip-track');return{children:strip.children.length,caption:strip.querySelector('.aic-composer-strip-caption')?.textContent,phase:strip.dataset.aicPhase,track:track?getComputedStyle(track).backgroundImage:'',head:track?getComputedStyle(track,'::before').animationName:''};});
  expect(rail&&rail.children===5&&rail.caption==='INPUT / COMPOSER','Composer rail header cells are incomplete');
  expect(rail.phase==='ready','Composer rail phase must mirror the idle session');
  expect(rail.track==='none','Composer stream should have no scale ticks');
  expect(rail.head==='aic-composer-scan','Composer rail scanning head is missing');
  await featureSettings.getByLabel('加载完成后等待确认',{exact:false}).check();
  await featureSettings.getByRole('button',{name:'预览加载动画',exact:true}).click();
  await page.locator('.aic-boot[data-phase="awaiting"]').waitFor();
  await page.waitForTimeout(700);
  expect(await page.locator('.aic-boot').getAttribute('data-phase')==='awaiting','Loading gate entered automatically');
  expect((await page.locator('.aic-boot-wordmark').innerText()).includes('ORION'),'Loader did not use the configured title');
  await page.screenshot({path:resolve(output,'loader-awaiting.png')});
  await featureSettings.getByLabel('标题名称',{exact:false}).evaluate(n=>n.focus());
  await page.keyboard.press('k');
  await page.locator('.aic-boot').waitFor({state:'detached'});
  expect(await featureSettings.getByLabel('标题名称',{exact:false}).inputValue()==='ORION','Continue key leaked into the underlying input');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.locator('.aic-boot[data-phase="awaiting"]').waitFor();
  expect(await page.locator('.aic-boot').isVisible(),'Reduced motion bypassed the explicit loading gate');
  await page.evaluate(()=>{window.__aicLeakedClicks=0;document.addEventListener('click',()=>window.__aicLeakedClicks++);});
  await page.mouse.click(600,500);
  await page.locator('.aic-boot').waitFor({state:'detached'});
  expect(await page.evaluate(()=>window.__aicLeakedClicks)===0,'Continue click reached the underlying UI');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('.aic-settings-trigger').click();
  await featureSettings.getByLabel('加载完成后等待确认',{exact:false}).uncheck();
  await featureSettings.getByLabel('标题名称',{exact:false}).fill('AIC');
  const settings = page.getByRole('dialog', { name: 'AIC 主题设置', exact: true });
  await settings.getByLabel('信息密度', { exact: false }).selectOption('compact');
  await settings.getByLabel('强调色细节', { exact: false }).uncheck();
  await page.keyboard.press('Escape');
  expect(await page.locator('body').getAttribute('data-aic-density') === 'compact', 'Density did not update');
  expect(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'AIC 主题设置', 'Escape did not restore focus');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('body[data-aic-theme]').waitFor();
  expect(await page.locator('body').getAttribute('data-aic-effects') === 'off', 'Settings were not persisted');
  await page.getByRole('button', { name: 'AIC 主题设置', exact: true }).click();
  await page.getByRole('button', { name: '恢复默认设置', exact: true }).click();
  const surfaces = [];
  const accents = [];
  for (const scheme of ['oxide', 'ultraviolet', 'teal']) {
    await page.locator(`.aic-palette-option[data-scheme="${scheme}"]`).click();
    expect(await page.locator('body').getAttribute('data-aic-scheme') === scheme, 'Palette did not update');
    surfaces.push(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--dsw-alias-bg-base')));
    accents.push(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--dsw-alias-state-business-primary')));
  }
  expect(new Set(surfaces).size === 1, 'Neutral surfaces must not follow the palette');
  expect(new Set(accents).size === 3, 'The palettes do not have distinct accents');
  // A checked setting is a flat solid square: no rotation, no glow shadow.
  const mark = await settings.locator('input[type="checkbox"]:checked').first().evaluate(element => {
    const s = getComputedStyle(element, '::before'); return {background:s.backgroundColor,shadow:s.boxShadow,width:s.width,height:s.height};
  });
  expect(mark.background !== 'rgba(0, 0, 0, 0)' && mark.shadow === 'none' && mark.width === mark.height, 'Checked marks must be solid flat squares without glow');
  // Restraint guard: the main surfaces must paint no gradient and cast no glow.
  const flat = await page.evaluate(() => {
    const read = selector => { const node = document.querySelector(selector); if (!node) return null; const s = getComputedStyle(node); return {image:s.backgroundImage,shadow:s.boxShadow,width:node.getBoundingClientRect().width}; };
    return {
      composer: read('[data-composer-card]'),
      header: read('[data-slot="conversation.header"] > header'),
      projectRow: read('[data-slot="sidebar.workspaces"] [data-row-key^="workspace:"]'),
      sessionRow: read('[data-slot="sidebar.workspaces"] [data-row-key^="session:"]'),
      rail: read('[data-slot="conversation.view"] nav:has(> [class*="_scroller"] > [class*="_marks"])'),
      balance: read('.aic-balance'),
    };
  });
  for (const [name, style] of Object.entries(flat)) {
    if (!style) continue;
    expect(style.image === 'none', `${name} still paints a gradient: ${JSON.stringify(style)}`);
    // Inset rules are the flat selection markers; outer shadows are glow.
    const glows = style.shadow !== 'none' && !style.shadow.includes('inset');
    expect(!glows, `${name} still casts a shadow or glow: ${JSON.stringify(style)}`);
  }
  expect(!flat.rail || flat.rail.width <= 80, 'The turn axis must stay a thin gutter ruler');
  for (const [label, attribute] of [['项目树布局', 'data-aic-sidebar'], ['对话记录行', 'data-aic-sessions'], ['轮次竖轴', 'data-aic-turn-rail']]) {
    await settings.getByLabel(label, { exact: false }).uncheck();
    expect(await page.locator('body').getAttribute(attribute) === 'off', `${label}: toggle off failed`);
    await settings.getByLabel(label, { exact: false }).check();
  }
  await settings.getByLabel('账号余额组件', { exact: false }).uncheck();
  expect(await page.locator('.aic-balance').count() === 0, 'Balance toggle did not hide component');
  await settings.getByLabel('账号余额组件', { exact: false }).check();
  for (const [label,kind] of [['预览启动','start'],['预览停止','stop']]) {
    await settings.getByRole('button', {name:label,exact:true}).click();
    const fx=page.locator(`.aic-run-fx[data-kind="${kind}"]`);
    await fx.waitFor();
    expect(await fx.getAttribute('data-preview') === 'true', 'Preview falsely reported a real run');
    expect(await fx.evaluate(element => getComputedStyle(element).pointerEvents) === 'none', 'Transition blocks controls');
    const geometry = await fx.evaluate(element => {
      const rect = selector => { const r=element.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}; };
      return {board:rect('.aic-run-fx-label'),diag:rect('.aic-run-fx-diag'),edge:rect('.aic-run-fx-edge'),bottom:rect('.aic-run-fx-bottom'),badge:rect('.aic-run-fx-badge')};
    });
    expect(Math.abs(geometry.board.w / geometry.board.h - 2.85) < .08, 'Run notice board proportion regressed');
    expect(geometry.diag.x === geometry.board.x && geometry.diag.w === geometry.board.w && geometry.diag.h >= 74, 'Run notice diagnostic strip is misaligned');
    expect(geometry.edge.w === 3 && geometry.edge.h > 200 && geometry.bottom.h === 3, 'Run notice light strips collapsed');
    expect(Math.abs(geometry.bottom.y + geometry.bottom.h - geometry.board.y - geometry.board.h) < 1, 'Bottom light strip must meet the container edge');
    expect(geometry.badge.h < geometry.diag.h - 8, 'Run badge must have inset space');
  }
  await page.keyboard.press('Escape');

  if (process.env.DSH_SESSION_TITLE) {
    if (process.env.DSH_WORKSPACE_NAME) {
      const workspace = page.locator('[data-row-key^="workspace:"]').filter({hasText:process.env.DSH_WORKSPACE_NAME});
      if (await workspace.getAttribute('aria-expanded') !== 'true') await workspace.click();
    }
    await page.getByText(process.env.DSH_SESSION_TITLE, { exact: true }).first().click();
    await page.getByRole('tab', { name: '对话', exact: true }).click();
    await page.locator('.aic-activity:not([hidden])').waitFor();
    await page.waitForFunction(()=>{
      const composer=document.querySelector('[data-composer-card]'),terminal=document.querySelector('.aic-activity');
      return composer&&terminal&&composer.getBoundingClientRect().top-terminal.getBoundingClientRect().bottom>=7;
    });
    const alignment=await page.evaluate(()=>{
      const tabs=document.querySelector('[data-conversation-tabs]');
      const more=tabs.parentElement.querySelector('[class*="_viewsMoreAnchor"]');
      const slogan=document.querySelector('.aic-slogan');
      const corner=document.querySelector('[data-conversation-header-corner]');
      const utility=document.querySelector('[class*="_headerUtilities"]');
      const mid=n=>{const r=n.getBoundingClientRect();return r.y+r.height/2;};
      return{moreDelta:more?Math.abs(mid(more)-mid(tabs)):0,sloganClear:!slogan||getComputedStyle(slogan).display==='none'||slogan.getBoundingClientRect().left>Math.max(tabs.getBoundingClientRect().right,more?.getBoundingClientRect().right??0)+12,cornerDelta:Math.abs(mid(corner)-mid(utility))};
    });
    expect(alignment.moreDelta<1&&alignment.sloganClear,'Slogan or more-views button overlaps/misaligns with tabs');
    expect(alignment.cornerDelta<1,'Sidebar button must align with header controls');
    const toggle=page.locator('.aic-chip-button[aria-label="强调色细节"]');
    expect(await toggle.evaluate(n=>getComputedStyle(n).backgroundColor)!=='rgba(0, 0, 0, 0)','Active header toggle must be a solid colour block');
    await toggle.click();
    expect(await toggle.evaluate(n=>getComputedStyle(n).backgroundColor)==='rgba(0, 0, 0, 0)','Inactive toggle should return to an outline');
    await toggle.click();
    await page.getByRole('button',{name:'AIC 主题设置',exact:true}).click();
    await settings.getByLabel('对话内容居中',{exact:false}).uncheck();
    expect(await page.locator('body').getAttribute('data-aic-center-chat')==='off','Conversation centring switch did not update');
    const nativeAlignment=await page.locator('[data-chat-flow] [class*="_userRow"]').first().evaluate(n=>Math.abs(n.getBoundingClientRect().right-n.querySelector('[class*="_bubble"]').getBoundingClientRect().right));
    expect(nativeAlignment<1,'Disabling centring must restore native user-message alignment');
    await settings.getByLabel('对话内容居中',{exact:false}).check();
    await page.keyboard.press('Escape');
    const warning=page.locator('[data-chat-flow] [class*="_turnErrorDot"]').first();
    if(await warning.count())expect(await warning.evaluate(n=>n.getBoundingClientRect().width===16&&n.getBoundingClientRect().height===16&&getComputedStyle(n).borderLeftWidth==='0px'&&getComputedStyle(n).maskImage.includes('data:image/svg+xml')),'Turn failures must use an undistorted warning icon');
    expect(await page.locator('.aic-hero-dotfield').count()===0,'Dotfield must be removed after entering a conversation');
    const gridImage = await page.evaluate(() => getComputedStyle(document.querySelector('[data-slot="conversation.view"] [class*="_frame"]')).backgroundImage);
    expect(gridImage.includes('gradient'), 'Conversation window must paint the engineering grid');
    const headerText = await page.locator('.aic-header-telemetry').innerText();
    expect(headerText.includes('MONITOR'), 'Header telemetry chips missing');
    const activity = page.locator('.aic-activity');
    const activityText = await activity.innerText();
    expect(activityText.trim().length > 0, 'Activity log must contain loaded records');
    const box = await activity.evaluate(element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const frame = document.querySelector('[data-slot="conversation.view"] [class*="_frame"]').getBoundingClientRect();
      return { border: style.borderTopWidth, inside: rect.left >= frame.left - 1 && rect.right <= frame.right + 1 };
    });
    expect(box.border === '0px', 'Activity terminal must not draw a border');
    expect(box.inside, 'Activity terminal must sit inside the conversation frame');
    const layout = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const terminal=rect('.aic-activity'), composer=rect('[data-composer-card]'), mission=rect('.aic-mission');
      const user=document.querySelector('[data-chat-flow] [class*="_userStack"] > [class*="_bubble"]');
      const row=user?.closest('[class*="_userRow"]')?.getBoundingClientRect(), bubble=user?.getBoundingClientRect();
      const caps=[...document.querySelectorAll('[data-aic-cap]')].map(node=>node.dataset.aicCap);
      const controlHeights=[...document.querySelectorAll('[data-slot="conversation.header"] [data-aic-cap]')].map(node=>node.getBoundingClientRect().height);
      const line=document.querySelector('.aic-activity-line');
      const title=rect('[data-slot="conversation.header"] [class*="_crumbCurrent"]');
      const team=rect('[data-aic-cap="AGENT TEAM"]');
      const card=rect('[data-chat-flow] [class*="_presented"]');
      const column=card ? document.querySelector('[data-chat-flow] [class*="_presented"]').closest('[class*="_column"]').getBoundingClientRect() : null;
      const tabs=document.querySelector('[data-conversation-tabs]');
      const intensity=document.querySelector('.aic-intensity');
      const ruler=document.querySelector('[aria-label="轮次导航"]');
      return {caps, controlHeights, lineHeight:line?.getBoundingClientRect().height, gap:composer.top-terminal.bottom, rightGap:mission.left-composer.right, centerError:bubble?Math.abs(bubble.x+bubble.width/2-row.x-row.width/2):0,
        headerBaseline:Math.abs(title.bottom-team.bottom),cardFill:card?card.width/column.width:1,tabBorder:getComputedStyle(tabs).borderBottomWidth,
        intensityShadow:intensity?getComputedStyle(intensity).boxShadow:'none',rulerWidth:ruler?.getBoundingClientRect().width,rulerCaption:ruler?getComputedStyle(ruler,'::before').content:''};
    });
    // The host swaps the third group between AGENTS and BACKGROUND depending on what is running.
  expect(['AGENT TEAM','MODE'].every(cap=>layout.caps.includes(cap))&&layout.caps.length>=3, 'Header group captions missing');
    expect(layout.controlHeights.length >= 3 && layout.controlHeights.every(height=>height===26), 'Header action boxes must share a 26px height');
    expect(layout.lineHeight === 15 && layout.gap >= 7, `Terminal lines shrink or overlap the composer: ${JSON.stringify(layout)}`);
    expect(layout.rightGap >= 0, 'Mission block overlaps the composer');
    expect(layout.centerError < 1, 'User message is no longer centred');
    expect(layout.headerBaseline <= 1, 'Title and controls must remain on one baseline');
    expect(layout.cardFill >= .95, 'Delivered file card is too narrow');
    expect(layout.tabBorder === '0px', 'Tab divider duplicates the outer header border');
    expect(layout.intensityShadow === 'none', 'Reasoning scale must not cast a collective glow');
    expect(layout.rulerWidth === 68 && !layout.rulerCaption.includes('START'), 'Turn ruler does not match reference image 2');
    const refinements=await page.evaluate(()=>{
      const header=document.querySelector('[data-slot="conversation.header"]');
      const title=header.querySelector('[class*="_crumbCurrent"]').getBoundingClientRect();
      const group=header.querySelector('[class*="_headerActions"]').getBoundingClientRect();
      const tab=header.querySelector('[role="tab"][aria-selected="true"]');
      return{groupGap:group.left-title.right,radius:getComputedStyle(tab).borderRadius,stripeLeft:getComputedStyle(tab,'::after').left,stripeRight:getComputedStyle(tab,'::after').right,mission:getComputedStyle(document.querySelector('.aic-mission')).fontFamily};
    });
    expect(refinements.groupGap >= 12 && refinements.groupGap <= 28, 'Header control group is pushed to the right');
    expect(refinements.radius === '0px' && refinements.stripeLeft === '-1px' && refinements.stripeRight === '-1px', 'Tab corners or accent stripe are misaligned');
    expect(refinements.mission.startsWith('"JetBrains Mono"'), 'Mission technical labels use the wrong font');
    await page.getByRole('button',{name:'添加文件或调用指令',exact:true}).click();
    const menu=page.locator('[data-trigger-menu]').filter({has:page.getByRole('listbox')});
    const material=await menu.evaluate(n=>({background:getComputedStyle(n).backgroundColor,opacity:getComputedStyle(n).opacity,material:getComputedStyle(n.querySelector('[class*="_material"]')).display}));
    expect(/^rgb\(/.test(material.background) && material.opacity === '1' && material.material === 'none', 'Command menu must paint an opaque surface');
    await page.keyboard.press('Escape');
    // Focus only; do not change the reasoning value or submit a model selection.
    await page.locator('.aic-intensity input').evaluate(n=>n.focus());
    expect(await page.locator('.aic-intensity-shell').evaluate(n=>getComputedStyle(n).outlineStyle)==='none','Reasoning scale still shows a focus rectangle');
    expect(await page.locator('[data-composer-card]').evaluate(n=>{const c=document.createElement('canvas').getContext('2d');c.fillStyle=getComputedStyle(n).getPropertyValue('--aic-line');const neutral=c.fillStyle;c.fillStyle=getComputedStyle(n).borderTopColor;return c.fillStyle===neutral;}),'Focusing effort still adds a primary-colour frame to the composer');
    const denseRuler = await page.evaluate(() => {
      // Temporary invisible layout fixture; it does not represent session data.
      const original=document.querySelector('[aria-label="轮次导航"]');
      const clone=original.cloneNode(true);
      clone.style.visibility='hidden';clone.style.pointerEvents='none';clone.setAttribute('aria-hidden','true');
      const marks=clone.querySelector('[class*="_marks"]'), sample=marks.querySelector('button');
      marks.replaceChildren(...Array.from({length:120},(_,i)=>{const b=sample.cloneNode(true);b.dataset.index=String(i);b.removeAttribute('aria-current');return b;}));
      original.parentElement.append(clone);
      try {const bounds=marks.getBoundingClientRect();const boxes=[...marks.children].map(n=>n.getBoundingClientRect());return boxes.every(r=>r.height>0&&r.top>=bounds.top-1&&r.bottom<=bounds.bottom+1);}
      finally {clone.remove();}
    });
    expect(denseRuler, 'Dense turn marks escape the ruler');
    const cornerText = await page.locator('.aic-activity-corner').innerText();
    expect(cornerText.includes('AIC / ACTIVITY'), 'Corner telemetry heading missing');
    expect(cornerText.includes('工具结果'), 'Corner telemetry counters missing');
    const rail = page.locator('[data-slot="conversation.view"] nav button[data-index]');
    if (await rail.count()) {
      const first = rail.first();
      await first.click();
      await page.waitForFunction(() => !!document.querySelector('[data-slot="conversation.view"] nav button[data-index][aria-current="true"]'));
    }
    // The terminal must disappear outside the conversation page.
    await page.getByRole('tab', { name: '遥测', exact: true }).click();
    await page.locator('.aic-analysis').waitFor();
    await page.waitForTimeout(250);
    expect(await page.locator('.aic-activity:not([hidden])').count() === 0, 'Activity log must hide outside the conversation page');
    const filter = page.locator('.aic-legend button').first();
    if (await filter.count()) {
      await filter.click();
      expect(await filter.getAttribute('aria-pressed') === 'true', 'Event filter did not activate');
      await page.getByRole('button', { name: '清除筛选', exact: true }).click();
    }
  }

  const snapshots = [];
  for (const [width, height] of [[2560,1344], [1920,1080], [1440,1000], [1280,800], [768,1024], [390,844]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: resolve(output, `live-${width}.png`), animations: 'disabled' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`);
    await page.getByRole('button', { name: 'AIC 主题设置', exact: true }).click();
    const rect = await settings.boundingBox();
    expect(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width + 1 && rect.y + rect.height <= height + 1, `Settings escaped viewport at ${width}px`);
    await page.keyboard.press('Escape');
    snapshots.push({ width, height, overflow: false });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const duration = await page.locator('.aic-settings-trigger').evaluate(element => getComputedStyle(element).transitionDuration);
  expect(duration.split(',').every(value => parseFloat(value) <= .001), 'Reduced motion was not applied');
  const iconErrors = await page.evaluate(async svg => {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return parsed.querySelectorAll('parsererror').length;
  }, await (await import('node:fs/promises')).readFile(new URL('../icon.svg', import.meta.url), 'utf8'));
  expect(iconErrors === 0, 'Icon SVG is invalid');
  expect(errors.length === 0, `Browser errors: ${errors.join('; ')}`);
  await writeFile(resolve(output, 'browser-report.json'), JSON.stringify({ snapshots, browserErrors: errors, schemes:3, neutralSurfaces:true, accentOnly:true, flatSurfaces:true, hollowDiamonds:true, activity:true, boot:true, bootWaitKeyboard:true, bootWaitMouse:true, bootWaitPersists:true, bootWaitReducedMotion:true, inputConsumed:true, titleName:true, composerStrip:true, composerStreamHeight:8, centeringToggle:true, headerToggleBlocks:true, tabRowAlignment:true, sidebarAlignment:true, sheetAnnotations:newSessionBackdrop, mirroredRulers:newSessionBackdrop, parallax:newSessionBackdrop, independentModules:true, runPreviews:true, newSessionBackdrop, runLightStates:true, reducedMotion: true, iconValid: true }, null, 2));
  console.log(`Live UI passed at ${snapshots.length} viewport sizes; neutral surfaces, two-colour schemes, hollow diamonds, activity console, boot curtain, flat marks, module switches, transitions, settings, focus and reduced motion verified.`);
} catch (error) {
  console.error(String(error.message).replaceAll(url, '[local authenticated URL]'));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
