    /** Safe account Remote projection; credentials stay inside the Host. */
    const ACCOUNT_CLIENT_VERSION = /* @account-client-version */;

    function formatWalletBalance(wallet) {
      if (!wallet || typeof wallet.balance !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(wallet.balance) || !['CNY', 'USD'].includes(wallet.currency)) return '—';
      const symbol = wallet.currency === 'CNY' ? '¥' : '$';
      const negative = wallet.balance.startsWith('-');
      const [rawInteger, fraction = ''] = wallet.balance.replace(/^-/, '').split('.');
      const integer = rawInteger.replace(/^0+(?=\d)/, '');
      const nonzero = /[1-9]/.test(integer + fraction);
      let cents = BigInt(integer) * 100n + BigInt((fraction + '00').slice(0, 2));
      if (!nonzero) return `${symbol}0.00`;
      if (cents === 0n) return negative ? `-${symbol}0.01` : `<${symbol}0.01`;
      if (negative && Number(fraction[2] ?? '0') >= 5) cents++;
      const whole = String(cents / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return `${negative ? '-' : ''}${symbol}${whole}.${String(cents % 100n).padStart(2, '0')}`;
    }

    function validWallets(value) {
      if (!Array.isArray(value)) return [];
      return value.filter(wallet => wallet && ['CNY', 'USD'].includes(wallet.currency)
        && typeof wallet.balance === 'string' && /^-?\d+(?:\.\d+)?$/.test(wallet.balance))
        .map(wallet => ({ currency: wallet.currency, balance: wallet.balance }));
    }

    /**
     * One controller shared by every balance seat. No API keys, raw account
     * details, signed URLs or identity fields enter its snapshot or storage.
     */
    function createBalanceController(remote, metadata) {
      let state = { status: 'loading', wallets: [], bonusWallets: [], updatedAt: null };
      const observers = new Set();
      let active = false;
      let revision = 0;
      let pending = null;
      let timer = null;
      let stream = null;
      const publish = next => { state = next; for (const observer of observers) observer(); };
      const fail = () => publish({ ...state, status: state.wallets.length ? 'stale' : 'error' });
      const refresh = () => {
        if (!active || document.visibilityState === 'hidden') return Promise.resolve();
        if (pending) return pending;
        const generation = revision;
        publish({ ...state, status: state.wallets.length ? 'refreshing' : 'loading' });
        const request = Promise.resolve().then(async () => {
          try {
            if (!active || generation !== revision) return;
            const account = await remote.account.getState();
            if (!active || generation !== revision) return;
            if (!account.ok) throw new Error('account-state-unavailable');
            if (account.value?.status !== 'credential-stored') {
              publish({ status: 'signed-out', wallets: [], bonusWallets: [], updatedAt: null });
              return;
            }
            const result = await remote.account.getBalance(metadata());
            if (!active || generation !== revision) return;
            if (!result.ok) throw new Error('account-balance-unavailable');
            if (result.value === null) {
              // Null means the grant disappeared or changed during the read.
              publish({ status: 'unavailable', wallets: [], bonusWallets: [], updatedAt: null });
              return;
            }
            if (result.value.status !== 'ready') throw new Error('account-balance-unavailable');
            const wallets = validWallets(result.value.value);
            const bonusWallets = validWallets(result.value.bonusWallets).filter(wallet => /[1-9]/.test(wallet.balance) && !wallet.balance.startsWith('-'));
            publish({ status: wallets.length ? 'ready' : 'unavailable', wallets, bonusWallets, updatedAt: Date.now() });
          } catch {
            if (active && generation === revision) fail();
          } finally {
            if (pending === request) pending = null;
          }
        });
        pending = request;
        return request;
      };
      const visible = () => {
        if (document.visibilityState !== 'hidden' && (!state.updatedAt || Date.now() - state.updatedAt >= 60000)) void refresh();
      };
      function start() {
        if (active) return;
        active = true;
        revision++;
        document.addEventListener('visibilitychange', visible);
        timer = window.setInterval(() => { void refresh(); }, 60000);
        void refresh();
        if (typeof remote.$stream !== 'function' || typeof remote.account.watch !== 'function') return;
        let watch;
        try { watch = remote.$stream({ name: 'aic-account-balance', open: signal => remote.account.watch(signal), ended: () => new Error('account state stream ended') }); }
        catch { fail(); return; }
        stream = watch;
        (async () => {
          for await (const frame of watch) {
            if (!active || stream !== watch) break;
            revision++;
            pending = null;
            const signedIn = frame.value?.status === 'credential-stored';
            publish({ status: signedIn ? 'loading' : 'signed-out', wallets: [], bonusWallets: [], updatedAt: null });
            frame.accept();
            if (signedIn) void refresh();
          }
        })().catch(() => { if (active && stream === watch) fail(); });
      }
      function stop() {
        if (!active) return;
        active = false;
        revision++;
        pending = null;
        window.clearInterval(timer);
        timer = null;
        document.removeEventListener('visibilitychange', visible);
        const previous = stream;
        stream = null;
        previous?.dispose();
      }
      return {
        getSnapshot: () => state,
        subscribe: observer => { observers.add(observer); return () => observers.delete(observer); },
        refresh, start, stop,
        dispose() { stop(); observers.clear(); },
      };
    }

    function Balance(props) {
      const current = useOptions();
      const t = translate(props);
      const state = useSyncExternalStore(props.balanceStore.subscribe, props.balanceStore.getSnapshot);
      if (!current.balance) return null;
      const statusKey = state.status === 'signed-out' ? 'balanceSignedOut' : state.status === 'error' ? 'balanceError'
        : state.status === 'unavailable' ? 'balanceUnavailable' : state.status === 'stale' ? 'balanceStale'
          : state.status === 'loading' || state.status === 'refreshing' ? 'balanceLoading' : 'balanceAccount';
      const busy = state.status === 'loading' || state.status === 'refreshing';
      const wallets = state.wallets;
      const timestamp = state.updatedAt ? new Date(state.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const amounts = wallets.length ? wallets.map(wallet => formatWalletBalance(wallet)).join(' / ') : '—';
      return h('section', { className: 'aic-balance', 'data-status': state.status, 'data-wide': props.wide !== false,
        'aria-label': t('balanceTitle'), title: `${t('balanceTitle')} · ${amounts} · ${t(statusKey)}` },
      h('div', { className: 'aic-balance-header' },
        h('span', { className: 'aic-balance-tag' }, 'ACCOUNT / CREDIT'),
        h('button', { className: 'aic-balance-refresh', type: 'button', 'aria-label': t('balanceRefresh'), title: t('balanceRefresh'), disabled: busy,
          onClick: () => { void props.balanceStore.refresh(); } }, '↻')),
      h('div', { className: 'aic-balance-values' }, wallets.length ? wallets.map(wallet => h('span', {
        key: wallet.currency, className: 'aic-balance-amount', title: `${wallet.currency} ${wallet.balance}`,
      }, formatWalletBalance(wallet))) : h('span', { className: 'aic-balance-placeholder' }, '—')),
      state.bonusWallets.length > 0 && h('div', { className: 'aic-balance-bonus' },
        h('span', null, t('balanceBonus')), ...state.bonusWallets.map(wallet => h('span', { key: wallet.currency, title: `${wallet.currency} ${wallet.balance}` }, formatWalletBalance(wallet)))),
      h('div', { className: 'aic-balance-footer' }, h('span', { role: 'status' }, t(statusKey)), h('time', { className: 'aic-mono' }, timestamp)));
    }

    function installAccount(ctx) {
      ctx.inject(['remote', 'remote.account'], scope => {
        const metadata = () => ({ version: ACCOUNT_CLIENT_VERSION, locale: navigator.language || 'zh-CN', timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60 });
        const controller = createBalanceController(scope.remote, metadata);
        scope.effect(() => {
          const sync = () => options.balance ? controller.start() : controller.stop();
          const unsubscribe = subscribe(sync);
          sync();
          return () => { unsubscribe(); controller.dispose(); };
        }, 'aic: account balance lifetime');
        scope.slots.inject('sidebar.footer.action', () => scope.slots.register({
          name: 'sidebar.footer.action', id: 'aic-balance', order: -20, locale: NS,
          inject: () => ({ balanceStore: controller }),
        }, Balance));
      });
    }
