import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function fixture() {
  let child=null, present=true, now=0, serial=0, mutation;
  const frames=new Map(), events=new Map(), mediaListeners=new Set();
  const media={matches:false,addEventListener:(_,fn)=>mediaListeners.add(fn),removeEventListener:(_,fn)=>mediaListeners.delete(fn)};
  const observers=[];
  const rect={left:40,top:20,width:320,height:240};
  const ctx={fills:0,rounds:0,vertices:0,setTransform(){},clearRect(){},beginPath(){},moveTo(){this.vertices++;},lineTo(){this.vertices++;},closePath(){},stroke(){},arc(){},roundRect(){this.rounds++;},fill(){this.fills++;},drawImage(){},fillRect(){},createPattern(){return {};},createRadialGradient(){return{addColorStop(){}};}};
  const root={get isConnected(){return present;},getBoundingClientRect:()=>rect,prepend:n=>{child=n;},contains:()=>true};
  const body={dataset:{aicDecoration:'on',aicMotion:'on'},hasAttribute:key=>key==='data-ds-dark-theme'};
  const document={body,visibilityState:'visible',querySelector:()=>present?root:null,
    createElement:()=>({dataset:{},getContext:()=>ctx,setAttribute(){},getBoundingClientRect:()=>rect,
      get isConnected(){return present&&child===this;},remove(){if(child===this)child=null;}}),
    addEventListener:(key,fn)=>events.set(key,fn),removeEventListener:(key,fn)=>{if(events.get(key)===fn)events.delete(key);}};
  class ResizeObserver {constructor(){observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
  class MutationObserver {constructor(fn){mutation=fn;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
  const scope={document,window:{matchMedia:()=>media,devicePixelRatio:1},ResizeObserver,MutationObserver,
    requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),performance:{now:()=>now}};
  vm.runInNewContext(readFileSync(new URL('../src/hero-dotfield.js',import.meta.url),'utf8'),scope);
  const dispose=scope.installHeroDotfield();
  const tick=time=>{now=time;const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn(time));};
  const click=(x=90,y=70,control=false)=>{
    const event={button:0,pointerId:1,clientX:x,clientY:y,target:{closest:()=>control?{}:null}};
    events.get('pointerdown')?.(event);events.get('pointerup')?.(event);
  };
  return{get canvas(){return child;},ctx,body,document,frames,events,media,mediaListeners,observers,
    tick,click,sync:()=>mutation(),leave:()=>{present=false;mutation();},dispose};
}

test('engineering backdrop supersamples four translucent hollow planes and stays idle between interactions',()=>{
  const app=fixture();
  app.tick(0);
  assert.equal(app.canvas.width,640);
  assert.equal(app.canvas.height,480);
  assert.equal(app.canvas.dataset.fieldState,'static');
  assert.equal(app.canvas.dataset.shape,'layered-hollow-diamond');
  assert.equal(app.canvas.dataset.nodeShape,'continuous');
  assert.equal(app.canvas.dataset.layerCount,'4');
  assert.equal(app.canvas.dataset.renderStrategy,'cached-mask');
  assert.equal(app.ctx.fillStyle,'#D4D4D4');
  assert.ok(app.ctx.vertices>0);
  assert.equal(app.frames.size,0);
  app.dispose();
  assert.equal(app.canvas,null);
  assert.equal(app.events.size,0);
  assert.equal(app.mediaListeners.size,0);
  assert.ok(app.observers.every(observer=>!observer.active));
});

test('diamond layers share their default centre and parallax separates them by depth',()=>{
  const scope={};
  vm.runInNewContext(readFileSync(new URL('../src/hero-dotfield.js',import.meta.url),'utf8'),scope);
  const resting=scope.heroDiamondLayers(1200,900);
  assert.ok(resting.every(layer=>layer.x===600&&layer.y===450));
  const moved=scope.heroDiamondLayers(1200,900,{x:1,y:-1});
  assert.deepEqual(Array.from(moved,layer=>layer.x),[603,607,612,618]);
  assert.deepEqual(Array.from(moved,layer=>layer.y),[447.75,444.75,441,436.5]);
});

test('pointer parallax eases back to the shared centre and stops requesting frames',()=>{
  const app=fixture();app.tick(0);
  app.events.get('pointermove')({clientX:340,clientY:70,target:{closest:()=>null}});
  app.tick(16);
  assert.ok(Number(app.canvas.dataset.parallaxX)>0);
  app.events.get('pointerleave')();
  for(let time=32;time<2400;time+=16)app.tick(time);
  assert.equal(app.canvas.dataset.parallaxX,'0');
  assert.equal(app.canvas.dataset.parallaxY,'0');
  assert.equal(app.frames.size,0);
  app.dispose();
});

test('rapid background clicks have bounded ripples that finish; control clicks do not trigger them',()=>{
  const app=fixture();app.tick(0);
  const initialGeometry=app.ctx.vertices;
  app.click(90,70,true);app.tick(10);
  assert.equal(app.canvas.dataset.rippleCount,'0');
  for(let i=0;i<20;i++)app.click(90+i,70);
  app.tick(100);
  assert.equal(app.canvas.dataset.rippleCount,'6');
  assert.equal(app.canvas.dataset.fieldState,'ripple');
  assert.equal(app.ctx.vertices,initialGeometry,'Ripple frames must reuse the cached construction geometry');
  assert.equal(app.frames.size,1);
  app.tick(5000);
  assert.equal(app.canvas.dataset.fieldState,'static');
  assert.equal(app.frames.size,0);
  app.dispose();
});

test('decoration, reduced motion and visibility stop work without leaving duplicate canvases',()=>{
  const app=fixture();app.tick(0);
  const first=app.canvas;
  app.click();app.tick(100);
  app.body.dataset.aicDecoration='off';app.sync();
  assert.equal(app.canvas,null);assert.equal(app.frames.size,0);
  app.body.dataset.aicDecoration='on';app.sync();app.tick(200);
  assert.notEqual(app.canvas,first);
  app.media.matches=true;app.sync();app.click();app.tick(300);
  assert.equal(app.canvas.dataset.fieldState,'static');assert.equal(app.frames.size,0);
  app.media.matches=false;app.click();app.tick(400);
  app.document.visibilityState='hidden';app.events.get('visibilitychange')();
  assert.equal(app.frames.size,0);
  app.document.visibilityState='visible';app.events.get('visibilitychange')();app.tick(500);
  assert.equal(app.canvas.dataset.fieldState,'static');
  app.dispose();
});

test('leaving the new-session screen removes the canvas and cancels its pending animation',()=>{
  const app=fixture();app.tick(0);app.click();app.tick(100);
  app.leave();
  assert.equal(app.canvas,null);assert.equal(app.frames.size,0);
  app.dispose();
  assert.equal(app.events.size,0);
});
