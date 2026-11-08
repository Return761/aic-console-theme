import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildPalettes,SCHEME_COLORS,ACCENT_TOKENS,CONTRAST_TOKENS} from '../src/palettes.mjs';
import {harness} from './harness.mjs';
const base={...JSON.parse(readFileSync(new URL('../src/palette.json',import.meta.url))),...JSON.parse(readFileSync(new URL('../src/palette-extra.json',import.meta.url)))};
const luminance=h=>h.slice(1,7).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('palettes change only the two theme colours; every neutral surface stays identical',()=>{
  assert.equal(SCHEME_COLORS.oxide.dark.accent,'#AA2827');
  assert.equal(SCHEME_COLORS.oxide.light.accent,'#AA2827');
  const palettes=buildPalettes(base);
  const names=Object.keys(SCHEME_COLORS);
  const neutral=Object.keys(palettes.teal.tokens).filter(key=>!ACCENT_TOKENS.includes(key)&&!CONTRAST_TOKENS.includes(key));
  assert.ok(neutral.length>20);
  for(const name of names)for(const key of neutral)
    assert.deepEqual(palettes[name].tokens[key],palettes.teal.tokens[key],`${name} changes neutral token ${key}`);
  for(const key of ACCENT_TOKENS)for(const mode of ['dark','light']){
    const values=names.map(name=>palettes[name].tokens[key][mode]);
    assert.equal(new Set(values).size,names.length,`${key}/${mode} is not scheme specific`);
  }
  // Both theme colours are exposed: accent through host tokens, secondary as `--aic-action`.
  for(const name of names)for(const mode of ['dark','light']){
    const tokens=palettes[name].tokens;
    assert.equal(tokens['--aic-action'][mode],SCHEME_COLORS[name][mode].action);
    assert.equal(tokens['--dsw-alias-state-business-primary'][mode],SCHEME_COLORS[name][mode].accent);
  }
  for(const mode of ['dark','light']){
    const canvases=names.map(name=>palettes[name].tokens['--dsw-alias-bg-base'][mode]);
    assert.deepEqual(canvases,[base['--dsw-alias-bg-base'][mode],base['--dsw-alias-bg-base'][mode],base['--dsw-alias-bg-base'][mode]]);
  }
});

test('neutral text and both theme colours keep readable contrast in every mode',()=>{
  const palettes=buildPalettes(base);
  for(const name of Object.keys(SCHEME_COLORS))for(const mode of ['dark','light']){
    const tokens=palettes[name].tokens;
    assert.ok(contrast(tokens['--dsw-alias-label-primary'][mode],tokens['--dsw-alias-bg-layer-1'][mode])>=4.5,`${name}/${mode} body text`);
    assert.ok(contrast(tokens['--dsw-alias-label-secondary'][mode],tokens['--dsw-alias-bg-layer-1'][mode])>=4.5,`${name}/${mode} secondary text`);
    assert.ok(contrast(tokens['--dsw-alias-label-tertiary'][mode],tokens['--dsw-alias-interactive-bg-hover-solid'][mode])>=4.5,`${name}/${mode} muted text on hover`);
    assert.ok(contrast(tokens['--dsw-alias-brand-primary-invert'][mode],tokens['--dsw-alias-brand-primary'][mode])>=4.5,`${name}/${mode} button label`);
    assert.ok(contrast(tokens['--aic-action'][mode],tokens['--dsw-alias-bg-layer-1'][mode])>=4.5,`${name}/${mode} secondary colour as text`);
    for(const value of Object.values(tokens)){assert.ok(value.light);assert.ok(value.dark);}
  }
});

test('palette changes replace the owned token layer, validate saved input and dispose the latest layer',()=>{
  const app=harness();const accent='--dsw-alias-state-business-primary';const original=app.layer[accent].dark;
  app.storage.set('dsh-550-aic-theme/options/v1','{"scheme":"ultraviolet","sidebar":false,"sessionList":true}');app.events.get('storage')({key:'dsh-550-aic-theme/options/v1'});
  assert.notEqual(app.layer[accent].dark,original);
  assert.equal(app.layer['--aic-action'].dark,SCHEME_COLORS.ultraviolet.dark.action);
  assert.equal(app.layer['--dsw-alias-bg-base'].dark,base['--dsw-alias-bg-base'].dark);
  assert.equal(app.attributes.get('data-aic-sidebar'),'off');assert.equal(app.attributes.get('data-aic-sessions'),'on');
  app.storage.set('dsh-550-aic-theme/options/v1','{"scheme":"__proto__"}');app.events.get('storage')({key:null});assert.equal(app.attributes.get('data-aic-scheme'),'teal');
  app.dispose();assert.equal(app.layer,undefined);
});
