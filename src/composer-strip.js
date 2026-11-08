/** Decorative header inside the native composer. Reads existing session state.
 *  The rail is a calibrated input scale; its scanning head is decoration, never
 *  a progress or task indicator. The phase attribute only mirrors the real,
 *  host-provided composer/session state. */
function installComposerStrip() {
  if (typeof document.querySelectorAll !== 'function' || typeof MutationObserver !== 'function') return () => {};
  const owned = new Map();
  const write = (node, value) => { if (node.textContent !== value) node.textContent = value; };
  const sync = () => {
    for (const [card, row] of owned) if (!card.isConnected || !options.composerStrip) { row.remove(); owned.delete(card); }
    if (!options.composerStrip) return;
    for (const card of document.querySelectorAll('[data-composer-card]')) {
      let row = owned.get(card);
      if (!row || !row.isConnected) {
        row = document.createElement('div'); row.className = 'aic-composer-strip'; row.setAttribute('aria-hidden', 'true');
        for (const name of ['title', 'caption', 'track', 'session', 'state']) {
          const child = document.createElement('span'); child.className = `aic-composer-strip-${name}`; row.append(child);
        }
        card.prepend(row); owned.set(card, row);
      }
      const snapshot = activityBus.snapshot;
      const inert = card.querySelector('[data-composer-input]')?.getAttribute('data-phase') === 'inert';
      const phase = inert ? 'standby' : snapshot.running ? 'running' : 'ready';
      write(row.children[0], options.titleName); row.children[0].title = options.titleName;
      write(row.children[1], 'INPUT / COMPOSER');
      write(row.children[3], snapshot.hasSession ? `SESSION / ${String(snapshot.sessionId ?? '').slice(-8)}` : 'SESSION / NEW');
      write(row.children[4], phase === 'standby' ? 'STANDBY' : phase === 'running' ? 'RUNNING' : 'READY');
      row.dataset.aicPhase = phase;
    }
  };
  const observer = new MutationObserver(sync);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-phase'] });
  const stopOptions = subscribe(sync), stopActivity = subscribeActivity(sync);
  sync();
  return () => { observer.disconnect(); stopOptions(); stopActivity(); for (const row of owned.values()) row.remove(); owned.clear(); };
}
