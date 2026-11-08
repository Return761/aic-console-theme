import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/account.js', import.meta.url), 'utf8')
  .replace('/* @account-client-version */', () => JSON.stringify('0.3.0'));
const flush = () => new Promise(setImmediate);
const normalized = value => JSON.parse(JSON.stringify(value));

function environment() {
  const timers = new Set();
  const listeners = new Map();
  let now = 100000;
  const document = {
    visibilityState: 'visible',
    addEventListener(name, callback) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    removeEventListener(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const window = { setInterval(callback) { timers.add(callback); return callback; }, clearInterval(callback) { timers.delete(callback); } };
  const context = vm.createContext({ document, window, Date: class extends Date { static now() { return now; } } });
  vm.runInContext(source + '\n globalThis.accountTest = { createBalanceController, formatWalletBalance };', context);
  return {
    ...context.accountTest, document, timers, listeners,
    setNow(value) { now = value; },
    visibility(value) { document.visibilityState = value; for (const callback of listeners.get('visibilitychange') ?? []) callback(); },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function streamQueue() {
  const queue = [];
  let waiting;
  let disposed = false;
  let accepted = 0;
  const iterator = {
    [Symbol.asyncIterator]() { return this; },
    next() {
      if (queue.length) return Promise.resolve({ done: false, value: queue.shift() });
      if (disposed) return Promise.resolve({ done: true });
      return new Promise(resolve => { waiting = resolve; });
    },
    return() { return Promise.resolve({ done: true }); },
    dispose() { disposed = true; waiting?.({ done: true }); waiting = undefined; },
  };
  return {
    iterator,
    get disposed() { return disposed; },
    get accepted() { return accepted; },
    push(status) {
      const frame = { value: { status }, accept() { accepted++; } };
      if (waiting) { const resolve = waiting; waiting = undefined; resolve({ done: false, value: frame }); }
      else queue.push(frame);
    },
  };
}

const signedIn = () => Promise.resolve({ ok: true, value: { status: 'credential-stored' } });
const metadata = () => ({ version: '0.3.0', locale: 'zh-CN', timezoneOffsetSeconds: 28800 });
const ready = (value, bonusWallets = []) => ({ ok: true, value: { status: 'ready', value, bonusWallets } });

test('balances format exact decimal strings, preserve currencies and do not round a positive recharge upward', () => {
  const { formatWalletBalance } = environment();
  for (const [currency, balance, expected] of [
    ['CNY', '3.469999999999999999', '¥3.46'],
    ['USD', '9007199254740993.99', '$9,007,199,254,740,993.99'],
    ['USD', '0.001', '<$0.01'],
    ['CNY', '-0.001', '-¥0.01'],
    ['CNY', '-1.235', '-¥1.24'],
    ['CNY', '-1.231', '-¥1.23'],
    ['CNY', '-0.00000', '¥0.00'],
    ['USD', '0', '$0.00'],
  ]) assert.equal(formatWalletBalance({ currency, balance }), expected);
  for (const wallet of [null, { currency: 'EUR', balance: '1' }, { currency: 'CNY', balance: 1.23 }, { currency: 'CNY', balance: '1e3' }]) {
    assert.equal(formatWalletBalance(wallet), '—');
  }
});

test('normal and bonus currencies remain separate and unsafe fields are discarded', async () => {
  const env = environment();
  let receivedMetadata;
  const remote = { account: { getState: signedIn, getBalance: async client => {
    receivedMetadata = client;
    return ready([
      { currency: 'CNY', balance: '1.25', unexpected: 'discard' },
      { currency: 'USD', balance: '2.50' },
      { currency: 'CNY', balance: 3 },
    ], [{ currency: 'CNY', balance: '0.75' }, { currency: 'USD', balance: '0' }]);
  } } };
  const controller = env.createBalanceController(remote, metadata);
  controller.start();
  await controller.refresh();
  assert.deepEqual(normalized(controller.getSnapshot()), {
    status: 'ready', wallets: [{ currency: 'CNY', balance: '1.25' }, { currency: 'USD', balance: '2.50' }],
    bonusWallets: [{ currency: 'CNY', balance: '0.75' }], updatedAt: 100000,
  });
  assert.deepEqual(receivedMetadata, metadata());
  controller.dispose();
});

test('signed-out accounts do not query a balance or invent zero credit', async () => {
  const env = environment();
  let reads = 0;
  const controller = env.createBalanceController({ account: {
    getState: async () => ({ ok: true, value: { status: 'signed-out' } }),
    getBalance: async () => { reads++; return ready([]); },
  } }, metadata);
  controller.start();
  await controller.refresh();
  assert.equal(reads, 0);
  assert.deepEqual(normalized(controller.getSnapshot()), { status: 'signed-out', wallets: [], bonusWallets: [], updatedAt: null });
  controller.dispose();
});

test('a failed refresh retains previous credit and timestamp while marking the snapshot stale', async () => {
  const env = environment();
  let failure = false;
  const controller = env.createBalanceController({ account: { getState: signedIn, getBalance: async () => {
    if (failure) throw new Error('temporarily unreachable');
    return ready([{ currency: 'CNY', balance: '2.25' }]);
  } } }, metadata);
  controller.start();
  await controller.refresh();
  const before = controller.getSnapshot();
  env.setNow(200000);
  failure = true;
  await controller.refresh();
  const after = controller.getSnapshot();
  assert.equal(after.status, 'stale');
  assert.equal(after.updatedAt, before.updatedAt);
  assert.deepEqual(normalized(after.wallets), normalized(before.wallets));
  controller.dispose();
});

test('concurrent refresh calls share one RPC request', async () => {
  const env = environment();
  const response = deferred();
  let reads = 0;
  const controller = env.createBalanceController({ account: { getState: signedIn, getBalance: () => { reads++; return response.promise; } } }, metadata);
  controller.start();
  const first = controller.refresh();
  const second = controller.refresh();
  assert.equal(first, second);
  await flush();
  assert.equal(reads, 1);
  response.resolve(ready([{ currency: 'USD', balance: '1.00' }]));
  await first;
  assert.equal(controller.getSnapshot().status, 'ready');
  controller.dispose();
});

test('stop-before-response ignores late results and an old request cannot clear the restarted request', async () => {
  const env = environment();
  const oldResponse = deferred();
  const newResponse = deferred();
  let reads = 0;
  const controller = env.createBalanceController({ account: { getState: signedIn, getBalance: () => ++reads === 1 ? oldResponse.promise : newResponse.promise } }, metadata);
  controller.start();
  const oldRequest = controller.refresh();
  await flush();
  controller.stop();
  controller.start();
  const newRequest = controller.refresh();
  await flush();
  oldResponse.resolve(ready([{ currency: 'CNY', balance: '999.00' }]));
  await oldRequest;
  assert.equal(controller.getSnapshot().status, 'loading');
  assert.equal(controller.refresh(), newRequest);
  newResponse.resolve(ready([{ currency: 'USD', balance: '2.00' }]));
  await newRequest;
  assert.deepEqual(normalized(controller.getSnapshot().wallets), [{ currency: 'USD', balance: '2.00' }]);
  controller.dispose();
});

test('disable before a scheduled refresh microtask prevents the RPC from starting', async () => {
  const env = environment();
  let reads = 0;
  const controller = env.createBalanceController({ account: {
    getState: async () => { reads++; return { ok: true, value: { status: 'signed-out' } }; },
    getBalance: async () => ready([]),
  } }, metadata);
  controller.start();
  controller.stop();
  await flush();
  assert.equal(reads, 0);
  controller.dispose();
});

test('a sign-out stream frame invalidates an in-flight balance read immediately', async () => {
  const env = environment();
  const response = deferred();
  const stream = streamQueue();
  const remote = { $stream: () => stream.iterator, account: { getState: signedIn, getBalance: () => response.promise, watch() {} } };
  const controller = env.createBalanceController(remote, metadata);
  controller.start();
  const request = controller.refresh();
  await flush();
  stream.push('signed-out');
  await flush();
  assert.equal(controller.getSnapshot().status, 'signed-out');
  response.resolve(ready([{ currency: 'CNY', balance: '999.00' }]));
  await request;
  assert.equal(controller.getSnapshot().status, 'signed-out');
  assert.equal(controller.getSnapshot().wallets.length, 0);
  assert.equal(stream.accepted, 1);
  controller.dispose();
  assert.equal(stream.disposed, true);
});

test('a new signed-in generation wins over the previous account request', async () => {
  const env = environment();
  const oldResponse = deferred();
  const newResponse = deferred();
  const stream = streamQueue();
  let reads = 0;
  const remote = { $stream: () => stream.iterator, account: { getState: signedIn, getBalance: () => ++reads === 1 ? oldResponse.promise : newResponse.promise, watch() {} } };
  const controller = env.createBalanceController(remote, metadata);
  controller.start();
  const oldRequest = controller.refresh();
  await flush();
  stream.push('credential-stored');
  await flush();
  const newRequest = controller.refresh();
  assert.equal(reads, 2);
  oldResponse.resolve(ready([{ currency: 'CNY', balance: '999.00' }]));
  await oldRequest;
  assert.equal(controller.refresh(), newRequest);
  newResponse.resolve(ready([{ currency: 'CNY', balance: '2.00' }]));
  await newRequest;
  assert.deepEqual(normalized(controller.getSnapshot().wallets), [{ currency: 'CNY', balance: '2.00' }]);
  controller.dispose();
});

test('disable and dispose clean up polling, visibility listeners and account streams', async () => {
  const env = environment();
  const stream = streamQueue();
  let reads = 0;
  const controller = env.createBalanceController({ $stream: () => stream.iterator, account: { getState: signedIn, getBalance: async () => { reads++; return ready([]); }, watch() {} } }, metadata);
  controller.start();
  controller.start();
  await controller.refresh();
  assert.equal(env.timers.size, 1);
  assert.equal(env.listeners.get('visibilitychange').size, 1);
  const previousTimer = [...env.timers][0];
  controller.stop();
  previousTimer();
  env.visibility('visible');
  await controller.refresh();
  assert.equal(reads, 1);
  assert.equal(env.timers.size, 0);
  assert.equal(env.listeners.get('visibilitychange').size, 0);
  assert.equal(stream.disposed, true);
  controller.dispose();
  controller.dispose();
});

test('hidden documents defer balance traffic until becoming visible', async () => {
  const env = environment();
  let reads = 0;
  const controller = env.createBalanceController({ account: { getState: signedIn, getBalance: async () => { reads++; return ready([]); } } }, metadata);
  env.visibility('hidden');
  controller.start();
  await controller.refresh();
  assert.equal(reads, 0);
  env.visibility('visible');
  await controller.refresh();
  assert.equal(reads, 1);
  controller.dispose();
});
