import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, all } from './harness.mjs';
const stringsOf = tree => typeof tree === 'string' ? [tree] : typeof tree !== 'object' || tree === null ? [] : (tree.children ?? []).flatMap(stringsOf);

test('unload removes owned styles, token layer, registrations and listeners without touching unrelated attributes', () => {
  const app = harness();
  assert.ok(app.styles.length >= 5);
  assert.ok(app.layer['--dsw-specific-menu']);
  assert.equal(app.attributes.get('data-aic-theme'), '');
  assert.ok(app.events.has('storage'));
  app.dispose();
  assert.equal(app.styles.length, 0);
  assert.equal(app.layer, undefined);
  assert.equal(app.seats.length, 0);
  assert.equal(app.events.size, 0);
  assert.deepEqual([...app.attributes], [['data-existing', 'keep']]);
});

test('a malformed or legacy settings record cannot inject arbitrary options', () => {
  for (const stored of ['null', 'bad-json', '{"density":"tiny","effects":"yes","readout":false,"unknown":true}']) {
    const app = harness({ stored });
    assert.equal(app.attributes.get('data-aic-density'), 'compact');
    assert.equal(app.attributes.get('data-aic-effects'), 'on');
    app.dispose();
  }
});

test('configured title is sanitized and safely quoted in the owned CSS title layer', () => {
  const app = harness({ stored: JSON.stringify({titleName:'  ORION<>\u0000";--bad:red;/*  ', composerStrip:false, bootWaitForInput:true}) });
  const brand = app.find('aic-brand').component({});
  assert.equal(stringsOf(brand)[0], 'ORION";--bad:red;/*');
  const titleStyle = app.styles.find(tag=>tag.textContent.startsWith('body[data-aic-theme]{--aic-title-text:'));
  assert.equal(titleStyle.textContent, 'body[data-aic-theme]{--aic-title-text:'+JSON.stringify('ORION";--bad:red;/*')+';}');
  const inline=app.find('aic-theme-settings').component({});
  const content=all(inline,node=>typeof node.type==='function'&&node.type.name==='SettingsContent')[0];
  const tree=content.type(content.props);
  const toggles=all(tree,node=>node.type==='input'&&node.props.type==='checkbox');
  assert.equal(toggles[0].props.checked,false);
  assert.equal(toggles[1].props.checked,true);
  app.dispose();
});

test('loading gate is opt-in and empty or oversized title settings recover safely', () => {
  for (const [title,expected] of [['<>\u0000','AIC'],['X'.repeat(80),'X'.repeat(32)]]) {
    const app=harness({stored:JSON.stringify({titleName:title,bootWaitForInput:'true'})});
    assert.equal(stringsOf(app.find('aic-brand').component({}))[0],expected);
    const inline=app.find('aic-theme-settings').component({});
    const content=all(inline,node=>typeof node.type==='function'&&node.type.name==='SettingsContent')[0];
    const toggles=all(content.type(content.props),node=>node.type==='input'&&node.props.type==='checkbox');
    assert.equal(toggles[0].props.checked,true);
    assert.equal(toggles[1].props.checked,false);
    app.dispose();
  }
});

test('storage restrictions do not prevent activation; cross-tab updates and reset are validated', () => {
  const restricted = harness({ storageThrows: true });
  assert.equal(restricted.attributes.get('data-aic-theme'), '');
  restricted.dispose();
  const app = harness();
  app.storage.set('dsh-550-aic-theme/options/v1', '{"density":"compact","effects":false}');
  app.events.get('storage')({ key: 'dsh-550-aic-theme/options/v1' });
  assert.equal(app.attributes.get('data-aic-density'), 'compact');
  assert.equal(app.attributes.get('data-aic-effects'), 'off');
  app.storage.clear();
  app.events.get('storage')({ key: null });
  assert.equal(app.attributes.get('data-aic-density'), 'compact');
  app.dispose();
});

test('conversation centring can be disabled, persists, and restores the default on reset',()=>{
  const app=harness();
  assert.equal(app.attributes.get('data-aic-center-chat'),'on');
  const inline=app.find('aic-theme-settings').component({});
  const content=all(inline,node=>typeof node.type==='function'&&node.type.name==='SettingsContent')[0];
  const row=all(content.type(content.props),node=>node.type==='label'&&stringsOf(node).includes('对话内容居中'))[0];
  all(row,node=>node.type==='input')[0].props.onChange({target:{checked:false}});
  assert.equal(app.attributes.get('data-aic-center-chat'),'off');
  const stored=app.storage.get('dsh-550-aic-theme/options/v1');
  assert.equal(JSON.parse(stored).centerChat,false);
  const restored=harness({stored});
  assert.equal(restored.attributes.get('data-aic-center-chat'),'off');
  restored.dispose();
  app.storage.clear();app.events.get('storage')({key:null});
  assert.equal(app.attributes.get('data-aic-center-chat'),'on');
  app.dispose();
  assert.equal(app.attributes.has('data-aic-center-chat'),false);
});

test('single brand slots shadow at a distinct priority; feature extensions stay additive', () => {
  const app = harness({ missingModels: true });
  for (const id of ['aic-mark', 'aic-brand', 'aic-hero-mark']) assert.equal(app.find(id).options.priority, -50);
  assert.ok(app.find('aic-analysis'));
  assert.ok(app.find('aic-settings'));
  assert.equal(app.find('aic-intensity'), undefined);
  assert.equal(app.seats.some(seat => seat.options.name === 'conversation.input.model'), false);
  assert.equal(app.seats.some(seat => seat.options.name === 'conversation.session'), false);
  app.dispose();
});

function effortProps(overrides = {}) {
  let state = {
    current: { provider: 'custom', model: 'model-a', reasoningEffort: 'normal' }, status: 'ready',
    groups: [{ id: 'custom', models: [{ id: 'model-a', reasoning: { defaultEffort: 'normal', efforts: [{ id: 'normal', name: 'Normal' }, { id: 'deep', name: 'Deep' }] } }] }],
  };
  const calls = [];
  return { available: true, directory: { getSnapshot: () => state, subscribe: () => () => {} }, load() {}, select: async value => { calls.push(value); return { ok: true }; }, calls, ...overrides };
}

test('reasoning slider derives its options from the current provider and submits a complete route once', async () => {
  const app = harness();
  const props = effortProps();
  const tree = app.find('aic-intensity').component(props);
  const input = all(tree, node => node.type === 'input')[0];
  assert.equal(input.props.max, 1);
  assert.equal(input.props['aria-valuetext'], 'Normal');
  input.props.onPointerUp({ currentTarget: { value: '1' } });
  input.props.onPointerUp({ currentTarget: { value: '1' } });
  await new Promise(setImmediate);
  assert.equal(props.calls.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(props.calls[0])), { provider: 'custom', model: 'model-a', reasoningEffort: 'deep' });
  app.dispose();
});

test('unknown reasoning values stay disabled and unavailable providers do not render a misleading control', () => {
  const app = harness();
  const props = effortProps();
  props.directory.getSnapshot().current.reasoningEffort = 'unsupported';
  const tree = app.find('aic-intensity').component(props);
  assert.equal(all(tree, node => node.type === 'input')[0].props.disabled, true);
  assert.equal(app.find('aic-intensity').component(effortProps({ available: false })), null);
  app.dispose();
});

test('rejected reasoning selection exposes an error and does not mutate the provider snapshot', async () => {
  const app = harness();
  const props = effortProps({ select: async () => ({ ok: false, error: { message: 'Writer held' } }) });
  const input = all(app.find('aic-intensity').component(props), node => node.type === 'input')[0];
  input.props.onKeyUp({ key: 'End', currentTarget: { value: '1' } });
  await new Promise(setImmediate);
  assert.ok(app.stateWrites.includes('Writer held'));
  assert.equal(props.directory.getSnapshot().current.reasoningEffort, 'normal');
  app.dispose();
});

test('telemetry counts real loaded records and backfills tool errors to their actual turn', () => {
  const app = harness();
  const records = [
    { kind: 'user', seq: 1, time: 1000 },
    { kind: 'assistant', seq: 2, time: 1100, turn: 7, blocks: [{ kind: 'tool-call', callId: 'x', name: 'read' }] },
    { kind: 'tool-result', seq: 3, time: 1200, callId: 'x', call: { name: 'read' }, isError: true },
  ];
  const tree = app.find('aic-analysis').component({ useSession: fn => fn({ openState: 'open' }), useChat: fn => fn({ legacy: { nodes: records } }) });
  const metrics = all(tree, node => node.type === 'dd').map(node => node.children[0]);
  assert.deepEqual(metrics, [3, 1, 1, 1]);
  assert.equal(all(tree, node => node.props.className === 'aic-turn-cell')[0].props['data-error'], true);
  app.dispose();
});

test('telemetry distinguishes loading, unavailable data, empty records and a failed read', () => {
  const app = harness();
  const component = app.find('aic-analysis').component;
  const loading = component({ useSession: fn => fn({ openState: 'loading' }), useChat: fn => fn({ legacy: { nodes: [] } }) });
  assert.equal(loading.props.role, 'status');
  assert.equal(all(loading, node => node.type === 'dd').length, 0);
  const unavailable = component({ useSession: fn => fn({ openState: 'open' }) });
  assert.equal(all(unavailable, node => node.type === 'dd').length, 0);
  const empty = component({ useSession: fn => fn({ openState: 'open' }), useChat: fn => fn({ legacy: { nodes: [] } }) });
  assert.deepEqual(all(empty, node => node.type === 'dd').map(node => node.children[0]), [0, 0, 0, 0]);
  const failed = component({ useSession: fn => fn({ openState: 'error', openError: { message: 'Read failed' } }), useChat: fn => fn({ legacy: { nodes: [] } }) });
  assert.equal(failed.props.role, 'alert');
  assert.equal(failed.children[0], 'Read failed');
  app.dispose();
});

test('activity console folds loaded records into terminal lines, file list and counters', () => {
  const app = harness({ hooks: { useEffect: fn => { fn(); } } });
  const nodes = [
    { kind: 'user', seq: 1, blocks: [{ kind: 'text', text: '实现主题' }] },
    { kind: 'assistant', seq: 2, turn: 3, blocks: [] },
    { kind: 'tool-result', seq: 3, turn: 3, time: 1700000000000, call: { name: 'edit', argsRaw: JSON.stringify({ file_path: 'G:/Workspace/dsh/dsh-550-aic-theme/src/client.js' }) } },
    { kind: 'tool-result', seq: 4, turn: 4, time: 1700000001000, call: { name: 'pwsh', argsRaw: JSON.stringify({ command: 'npm test' }) }, isError: true },
  ];
  const props = { useSession: fn => fn({ running: true }), useChat: fn => fn({ legacy: { nodes } }) };
  app.find('aic-activity-feed').component(props);
  const tree = app.find('aic-activity').component({});
  const log = tree.children[0];
  const corner = tree.children[1];
  assert.equal(log.props['data-running'], true);
  const strings = stringsOf(tree);
  const flat = strings.join('\n');
  assert.ok(flat.includes('client.js'), 'file target is visible');
  assert.ok(flat.includes('npm test'), 'command target is visible');
  assert.ok(flat.includes('edit') && flat.includes('pwsh'), 'tool names are visible');
  // Two loaded tools, one of them failed, two turns in the loaded window.
  const counts = all(corner, node => node.type === 'b').map(node => node.children[0]).slice(0, 3);
  assert.deepEqual(counts, [2, 2, 1]);
  const readout = app.find('aic-readout').component({ sessionId: 'session-12345678', useSession: fn => fn({ running: false }), useChat: fn => fn({ legacy: { nodes } }) });
  const readoutText = stringsOf(readout).join(' ');
  assert.ok(readoutText.includes('SID / 12345678'));
  assert.ok(readoutText.includes('文件 1'));
  app.dispose();
});

test('mission uses projections, preserves full task text and reports undisplayed tasks', () => {
  const app = harness({ hooks: { useEffect: fn => { fn(); } } });
  const tasks = Array.from({length:6}, (_,index)=>({content:`真实任务 ${index}：完整内容`,status:index===0?'in_progress':'pending'}));
  app.find('aic-activity-feed').component({useSession:fn=>fn({running:false}),useProjection:key=>key==='todos'?tasks:{goal:{objective:'真实目标',phase:'active'}}});
  const tree=app.find('aic-activity').component({});
  const text=stringsOf(tree).join(' ');
  assert.ok(text.includes('GOAL') && text.includes('真实目标'));
  assert.ok(text.includes('1 进行中 · 5 待处理 · 0 已完成'));
  assert.equal(all(tree,node=>node.props.className==='aic-mission-task').length,4);
  assert.ok(text.includes('另 2 项未完成'));
  assert.ok(text.includes('真实任务 0：完整内容'));
  app.dispose();
});

test('missing or cleared task projection cannot reuse DOM summaries or completed goals', () => {
  const app = harness({ hooks: { useEffect: fn => { fn(); } } });
  const feeder=app.find('aic-activity-feed').component;
  const render=()=>stringsOf(app.find('aic-activity').component({})).join(' ');
  feeder({useSession:fn=>fn({running:false}),useProjection:key=>key==='todos'?undefined:{goal:{objective:'已结束的旧目标',phase:'complete'}}});
  assert.ok(render().includes('任务数据不可用'));
  assert.ok(render().includes('CONTEXT'));
  assert.ok(!render().includes('已结束的旧目标'));
  feeder({useSession:fn=>fn({running:false}),useProjection:()=>null});
  assert.ok(render().includes('本轮暂无任务'));
  app.dispose();
});
