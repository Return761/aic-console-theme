import vm from 'node:vm';
import { readFileSync } from 'node:fs';

export function harness({ stored, storageThrows = false, missingModels = false, remote, hooks = {} } = {}) {
  const attributes = new Map([['data-existing', 'keep']]);
  const styles = [];
  const cleanups = [];
  const seats = [];
  const events = new Map();
  const stateWrites = [];
  const storage = new Map(stored === undefined ? [] : [['dsh-550-aic-theme/options/v1', stored]]);
  let definition;
  let layer;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    Fragment: Symbol('fragment'),
    useState: value => [typeof value === 'function' ? value() : value, next => stateWrites.push(next)],
    useRef: value => ({ current: value }),
    useMemo: fn => fn(),
    useEffect() {}, useLayoutEffect() {}, useId: () => 'test-id',
    useSyncExternalStore: (_, snapshot) => snapshot(),
    ...hooks,
  };
  const body = {
    getAttribute: key => attributes.get(key) ?? null,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key),
    dataset: new Proxy({}, { set: (_, key, value) => { attributes.set('data-' + key.replace(/[A-Z]/g, ch => '-' + ch.toLowerCase()), String(value)); return true; } }),
  };
  const window = {
    localStorage: {
      getItem: key => { if (storageThrows) throw new Error('blocked'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (storageThrows) throw new Error('blocked'); storage.set(key, value); },
    },
    addEventListener: (key, fn) => events.set(key, fn),
    removeEventListener: (key, fn) => { if (events.get(key) === fn) events.delete(key); },
    setInterval, clearInterval,
    __ModuleLoader__: { load: value => { definition = value.factory(() => React); } },
  };
  const document = {
    body,
    visibilityState: 'visible',
    addEventListener: (key, fn) => events.set(key, fn),
    removeEventListener: (key, fn) => { if (events.get(key) === fn) events.delete(key); },
    head: { append: tag => styles.push(tag) },
    createElement: () => {
      const tag = { dataset: {}, textContent: '', remove: () => { const index = styles.indexOf(tag); if (index >= 0) styles.splice(index, 1); } };
      return tag;
    },
  };
  vm.runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), { window, document, navigator: { language: 'zh-CN' }, console, setTimeout, clearTimeout });
  const ctx = {
    get: () => undefined,
    effect: fn => { const dispose = fn(); if (typeof dispose === 'function') cleanups.push(dispose); },
    theme: { overrideTokens: (id, tokens) => { layer = tokens; return () => { if (layer === tokens) layer = undefined; }; } },
    slots: {
      inject: (_, fn) => fn(),
      register: (options, component) => {
        const seat = { options, component };
        seats.push(seat);
        cleanups.push(() => { const i = seats.indexOf(seat); if (i >= 0) seats.splice(i, 1); });
        return () => {};
      },
    },
    remote,
    inject: (names, fn) => { if (names.includes('remote.account')) { if (remote) fn(ctx); } else if (!missingModels) fn(ctx); },
  };
  definition.apply(ctx);
  return {
    definition, attributes, styles, seats, events, storage, stateWrites, React,
    get layer() { return layer; },
    dispose: () => { while (cleanups.length) cleanups.pop()(); },
    find: id => seats.find(seat => seat.options.id === id),
  };
}

export function all(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  return [...(predicate(tree) ? [tree] : []), ...(tree.children ?? []).flatMap(child => all(child, predicate))];
}
