import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function fixture({local=true,failChunks=false,deferred=false}={}){
  const registered=new Set(),chunks=[],pending=[];const runtime={};
  class FontFace{
    constructor(family,source,descriptors){Object.assign(this,{family,source,...descriptors});}
    load(){
      if(this.source.startsWith('local(')&&!local)return Promise.reject(new Error('Missing local font'));
      if(deferred)return new Promise(resolve=>pending.push(()=>resolve(this)));
      return Promise.resolve(this);
    }
  }
  const require={async:async chunk=>{chunks.push(chunk);if(failChunks)throw new Error('Unavailable chunk');return{source:'url(data:font/ttf;base64,original)'};}};
  const scope={FontFace,require,runtime,document:{fonts:{add:f=>registered.add(f),delete:f=>registered.delete(f)}}};
  vm.runInNewContext(readFileSync(new URL('../src/harmony-fonts.js',import.meta.url),'utf8'),scope);
  const dispose=scope.installHarmonyFonts();
  return{runtime,registered,chunks,pending,dispose};
}
test('installed body faces avoid font downloads and owned registrations are removed on unload',async()=>{
  const app=fixture();const results=await app.runtime.harmonyReady;
  assert.ok(results.every(r=>r.loaded&&r.source==='local'));
  assert.deepEqual([...app.registered].map(f=>f.weight),['400','500','700']);
  assert.equal(app.chunks.length,0);app.dispose();assert.equal(app.registered.size,0);
});
test('missing local fonts load the three original-font chunks and handle load failures',async()=>{
  const app=fixture({local:false});const results=await app.runtime.harmonyReady;
  assert.ok(results.every(r=>r.loaded&&r.source==='bundled'));assert.equal(app.registered.size,3);assert.equal(new Set(app.chunks).size,3);app.dispose();
  const failed=fixture({local:false,failChunks:true});
  assert.ok((await failed.runtime.harmonyReady).every(r=>!r.loaded&&r.source==='fallback'));assert.equal(failed.registered.size,0);failed.dispose();
});
test('font loads completing after unload cannot register late faces',async()=>{
  const app=fixture({deferred:true});app.dispose();app.pending.forEach(resolve=>resolve());
  assert.ok((await app.runtime.harmonyReady).every(r=>!r.loaded));assert.equal(app.registered.size,0);
});
