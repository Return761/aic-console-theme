import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, all } from './harness.mjs';

function hookRenderer() {
  let cursor = 0;
  const cells = [], effects = [], cleanups = [];
  const same = (a,b) => a && b && a.length === b.length && a.every((x,i) => Object.is(x,b[i]));
  return {
    hooks: {
      useRef(value) { const i=cursor++; return cells[i] ??= {current:value}; },
      useState(value) { const i=cursor++; if (!(i in cells)) cells[i]=typeof value==='function'?value():value; return [cells[i],next=>{cells[i]=typeof next==='function'?next(cells[i]):next;}]; },
      useEffect(fn,deps) { const i=cursor++; if (!same(cells[i],deps)) {cells[i]=deps;effects.push(()=>{cleanups[i]?.();cleanups[i]=fn();});} },
    },
    render(component,props) {cursor=0;const tree=component(props);while(effects.length)effects.shift()();return tree;},
    dispose() {for(const cleanup of cleanups)cleanup?.();},
  };
}

test('run transitions use actual aggregate state, skip initial mount, and preview is separate', () => {
  const renderer=hookRenderer();
  const app=harness({hooks:renderer.hooks});
  let running=false;
  const props={useSessionStatus:selector=>selector(new Map([['first',{running}],['other',{running:false}]]))};
  const component=app.find('aic-run-atmosphere').component;
  const render=()=>renderer.render(component,props);
  let tree=render();
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx').length,0);
  running=true;render();tree=render();
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx')[0].props['data-kind'],'start');
  running=false;render();tree=render();
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx')[0].props['data-kind'],'stop');
  app.events.get('aic:preview-run-fx')({detail:'start'});tree=render();
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx')[0].props['data-preview'],true);
  assert.equal(app.attributes.get('data-aic-running'),'false');
  app.storage.set('dsh-550-aic-theme/options/v1','{"runFx":false}');app.events.get('storage')({key:'dsh-550-aic-theme/options/v1'});render();tree=render();
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx').length,0);
  renderer.dispose();app.dispose();
  assert.equal(app.events.has('aic:preview-run-fx'),false);
  assert.equal(app.attributes.has('data-aic-running'),false);
});

test('opening an already-running session does not pretend the agent just started', () => {
  const renderer=hookRenderer();const app=harness({hooks:renderer.hooks});
  const tree=renderer.render(app.find('aic-run-atmosphere').component,{useSessionStatus:selector=>selector(new Map([['a',{running:true}]]))});
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx').length,0);
  assert.equal(all(tree,n=>n.props.className==='aic-active-field').length,1);
  renderer.dispose();app.dispose();
});

test('one agent stopping still produces a stop transition when another continues',()=>{
  const renderer=hookRenderer();const app=harness({hooks:renderer.hooks});
  let second=true;
  const props={useSessionStatus:selector=>selector(new Map([['a',{running:true}],['b',{running:second}]]))};
  const component=app.find('aic-run-atmosphere').component;
  renderer.render(component,props);second=false;renderer.render(component,props);
  const tree=renderer.render(component,props);
  assert.equal(all(tree,n=>n.props.className==='aic-run-fx')[0].props['data-kind'],'stop');
  assert.equal(app.attributes.get('data-aic-running'),'true');
  renderer.dispose();app.dispose();
});
