/** AIC theme: token layer + scoped styles + additive, disposable UI slots. */
window.__ModuleLoader__.load({
  id: '@local/dsh-550-aic-theme',
  factory(require) {
    'use strict';
    const React = require('react');
    const { createElement: h, useState, useEffect, useLayoutEffect, useRef, useId, useSyncExternalStore } = React;
    const ID = '@local/dsh-550-aic-theme';
    const NS = 'aic-theme';
    const STORAGE_KEY = 'dsh-550-aic-theme/options/v1';
    const TOKENS = /* @palette */;
    const PALETTES = /* @schemes */;
    const STYLES = /* @styles */;
    const STRINGS = /* @locales */;
    const DEFAULTS = Object.freeze({ titleName: 'AIC', composerStrip: true, bootWaitForInput: false, centerChat: true, scheme: 'teal', density: 'compact', effects: true, readout: true, intensity: true, sidebar: true, sessionList: true, turnRail: true, decoration: true, motion: true, runFx: true, balance: true, activity: true, slogan: 'AIC // 视觉 · 数据 · 控制' });
    const listeners = new Set();
    let runtime = null;

    function validateOptions(value) {
      const clean = { ...DEFAULTS };
      if (value === null || typeof value !== 'object') return clean;
      if (value.density === 'compact' || value.density === 'standard') clean.density = value.density;
      if (Object.hasOwn(PALETTES, value.scheme)) clean.scheme = value.scheme;
      for (const key of ['composerStrip', 'bootWaitForInput', 'centerChat', 'effects', 'readout', 'intensity', 'sidebar', 'sessionList', 'turnRail', 'decoration', 'motion', 'runFx', 'balance', 'activity']) if (typeof value[key] === 'boolean') clean[key] = value[key];
      if (typeof value.titleName === 'string') clean.titleName = value.titleName.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 32) || 'AIC';
      if (typeof value.slogan === 'string') clean.slogan = value.slogan.replace(/[\u0000-\u001f<>]/g, '').slice(0, 80);
      return clean;
    }
    function readOptions() {
      try { return validateOptions(JSON.parse(window.localStorage.getItem(STORAGE_KEY))); }
      catch { return { ...DEFAULTS }; }
    }
    let options = readOptions();
    function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
    function useOptions() { return useSyncExternalStore(subscribe, () => options); }
    function updateOptions(next, persist = true) {
      options = validateOptions(next);
      if (persist) {
        try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options)); }
        catch { /* In-memory settings remain usable when browser storage is unavailable. */ }
      }
      if (runtime) {
        if (runtime.titleStyle) runtime.titleStyle.textContent = `body[data-aic-theme]{--aic-title-text:${JSON.stringify(options.titleName)};}`;
        document.body.dataset.aicDensity = options.density;
        document.body.dataset.aicEffects = options.effects ? 'on' : 'off';
        document.body.dataset.aicScheme = options.scheme;
        document.body.dataset.aicActivity = options.activity ? 'on' : 'off';
        for (const [key, name] of [['centerChat','aicCenterChat'],['sidebar','aicSidebar'],['sessionList','aicSessions'],['turnRail','aicTurnRail'],['decoration','aicDecoration'],['motion','aicMotion'],['runFx','aicRunFx']]) document.body.dataset[name] = options[key] ? 'on' : 'off';
        if (runtime.palette !== options.scheme) {
          const previous = runtime.disposeTokens;
          runtime.disposeTokens = runtime.theme.overrideTokens(ID, PALETTES[options.scheme].tokens);
          previous?.();
          runtime.palette = options.scheme;
        }
      }
      for (const listener of listeners) listener();
    }
    function translate(props) {
      const source = props?.t ?? (key => STRINGS[(navigator.language || '').startsWith('zh') ? 'zh' : 'en'][key] ?? key);
      return key => displayTitle(source(key));
    }
    function displayTitle(value) { return typeof value === 'string' ? value.replace(/\bAIC\b/g, () => options.titleName) : value; }
    function Mark({ size = 24 }) {
      const d = 'M0 0H22.63L115 92.37V115H92.37L0 22.63Z';
      return h('svg', { className: 'aic-mark', width: size, height: size, viewBox: '0 0 264 264', fill: 'none', 'aria-hidden': true },
        h('g', { transform: 'translate(10 10)' },
          h('path', { d, fill: 'currentColor' }),
          h('path', { d, fill: 'var(--aic-secondary)', transform: 'translate(186.5 57.5) scale(-1 1) translate(-57.5 -57.5)' }),
          h('path', { d, fill: 'var(--aic-secondary)', transform: 'translate(57.5 186.5) rotate(180) scale(-1 1) translate(-57.5 -57.5)' }),
          h('path', { d, fill: 'currentColor', transform: 'translate(186.5 186.5) rotate(180) translate(-57.5 -57.5)' })));
    }
    function Brand() {
      const current = useOptions();
      return h('span', { className: 'aic-brand-lockup' },
        h('span', { className: 'aic-brand-name', title: current.titleName }, current.titleName), h('span', { className: 'aic-brand-edition' }, 'CONTROL / UI'));
    }

    const FONT_ROLES = [
      ['body', 'HarmonyOS Sans SC'], ['mono', 'JetBrains Mono'], ['number', 'Bahnschrift'], ['brand', 'Rajdhani'],
    ];
    function FontStatus({ t }) {
      const [status, setStatus] = useState({});
      useEffect(() => {
        let active = true;
        Promise.all(FONT_ROLES.map(async ([role, font]) => {
          try {
            if (font === 'HarmonyOS Sans SC') {
              const ready = await runtime?.harmonyReady;
              if (!ready?.every(face => face.loaded)) throw new Error('Bundled body fonts unavailable');
            }
            if (font === 'HarmonyOS Sans SC' || font === 'JetBrains Mono' || font === 'Rajdhani') {
              const faces = await document.fonts.load(`12px "${font}"`);
              if (!faces.length) throw new Error('Bundled face unavailable');
              return [role, true];
            }
            // Unlike document.fonts.check(), local() rejects a missing face rather
            // than reporting success because a fallback can satisfy the request.
            await new FontFace(`AIC-Probe-${role}`, `local("${font} Regular"), local("${font.replaceAll(' ', '')}-Regular"), local("${font}")`).load();
            return [role, true];
          } catch { return [role, false]; }
        })).then(entries => { if (active) setStatus(Object.fromEntries(entries)); });
        return () => { active = false; };
      }, []);
      return h('div', { className: 'aic-font-status' },
        h('div', { className: 'aic-eyebrow' }, t('fonts')),
        ...FONT_ROLES.map(([role, name]) => h('div', { key: role, className: 'aic-font-status-row', 'data-loaded': status[role] },
          h('span', null, name), h('span', null, status[role] === undefined ? t('checking') : status[role] ? t('available') : t('fallback')))),
        h('p', { className: 'aic-settings-note' }, t('fontNote')));
    }
    function SettingsContent(props) {
      const t = translate(props);
      const current = useOptions();
      return h('div', { className: 'aic-settings-body' },
        h('label', { className: 'aic-setting-row aic-setting-row-text' },
          h('span', null, t('titleName'), h('small', null, t('titleNameNote'))),
          h('input', { type: 'text', className: 'aic-input', value: current.titleName, maxLength: 32,
            onChange: event => updateOptions({ ...options, titleName: event.currentTarget.value }) })),
        h('fieldset', { className: 'aic-palette-picker' },
          h('legend', null, t('colorScheme')),
          ...Object.keys(PALETTES).map(scheme => h('button', { key: scheme, type: 'button', className: 'aic-palette-option', 'data-scheme': scheme, 'aria-pressed': current.scheme === scheme, style: {
            '--swatch-dark': PALETTES[scheme].tokens['--dsw-alias-state-business-primary'].dark,
            '--swatch-light': PALETTES[scheme].tokens['--dsw-alias-state-business-primary'].light,
          }, onClick: () => updateOptions({ ...options, scheme }) },
            h('span', { className: 'aic-palette-swatch', 'aria-hidden': true }), h('span', null, t(`scheme_${scheme}`)), h('small', null, t(`scheme_${scheme}_note`))))),
        h('label', { className: 'aic-setting-row' },
          h('span', null, t('density'), h('small', null, t('densityNote'))),
          h('select', { value: current.density, onChange: event => updateOptions({ ...options, density: event.target.value }) },
            h('option', { value: 'standard' }, t('standard')), h('option', { value: 'compact' }, t('compact')))),
        h('label', { className: 'aic-setting-row aic-setting-row-text' },
          h('span', null, t('slogan'), h('small', null, t('sloganNote'))),
          h('input', { type: 'text', className: 'aic-input', value: displayTitle(current.slogan), maxLength: 80,
            onChange: event => { const text = event.currentTarget.value; updateOptions({ ...options, slogan: text.startsWith(`${options.titleName} //`) ? `AIC${text.slice(options.titleName.length)}` : text }); } })),
        ...['composerStrip', 'bootWaitForInput', 'centerChat', 'effects', 'decoration', 'motion', 'sidebar', 'sessionList', 'turnRail', 'runFx', 'balance', 'activity', 'readout', 'intensity'].map(key => h('label', { key, className: 'aic-setting-row' },
          h('span', null, t(key), h('small', null, t(`${key}Note`))),
          h('input', { type: 'checkbox', checked: current[key], onChange: event => updateOptions({ ...options, [key]: event.target.checked }) }))),
        h('div', { className: 'aic-fx-preview' },
          h('span', { className: 'aic-eyebrow' }, t('previewFx')),
          h('button', { className: 'aic-button', type: 'button', onClick: () => window.dispatchEvent(new CustomEvent('aic:preview-boot')) }, t('previewBoot')),
          ...['start','stop'].map(kind => h('button', { key: kind, className: 'aic-button', type: 'button', disabled: !current.runFx, onClick: () => window.dispatchEvent(new CustomEvent('aic:preview-run-fx', { detail: kind })) }, t(`preview_${kind}`)))),
        h(FontStatus, { t }),
        h('button', { type: 'button', className: 'aic-button', onClick: () => updateOptions(DEFAULTS) }, t('reset')),
        h('p', { className: 'aic-settings-note' }, t('preferenceNote')));
    }
    function Settings(props) {
      const current = useOptions();
      const t = translate(props);
      const [open, setOpen] = useState(false);
      const [position, setPosition] = useState({ top: 12, left: 12 });
      const root = useRef(null);
      const trigger = useRef(null);
      const panel = useRef(null);
      const id = useId();
      useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
          const anchor = trigger.current?.getBoundingClientRect();
          const rect = panel.current?.getBoundingClientRect();
          if (!anchor || !rect) return;
          setPosition({
            left: Math.max(12, Math.min(anchor.right - rect.width, window.innerWidth - rect.width - 12)),
            top: Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - rect.height - 12)),
          });
        };
        place();
        window.addEventListener('resize', place);
        return () => window.removeEventListener('resize', place);
      }, [open]);
      useEffect(() => {
        if (!open) return;
        panel.current?.querySelector('button')?.focus();
        const outside = event => { if (!root.current?.contains(event.target)) setOpen(false); };
        const escape = event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
        };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
      }, [open]);
      return h('div', { ref: root },
        h('button', { ref: trigger, type: 'button', className: 'aic-button aic-settings-trigger', title: current.titleName, 'aria-label': t('settings'), 'aria-haspopup': 'dialog', 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => setOpen(!open) }, current.titleName, h('span', { 'aria-hidden': true }, '⌘')),
        open && h('section', { ref: panel, id, className: 'aic-settings', style: position, role: 'dialog', 'aria-label': t('settings') },
          h('div', { className: 'aic-settings-header' },
            h('h2', { className: 'aic-settings-title' }, `${current.titleName} / CONFIG`),
            h('button', { className: 'aic-button', type: 'button', 'aria-label': t('close'), onClick: () => { setOpen(false); trigger.current?.focus(); } }, '×')),
          h(SettingsContent, props)));
    }
    function InlineSettings(props) {
      const current = useOptions();
      return h('section', { className: 'aic-settings-inline', 'aria-label': translate(props)('settings') },
        h('div', { className: 'aic-settings-header' }, h('h2', { className: 'aic-settings-title' }, `${current.titleName} / CONTROL`)),
        h(SettingsContent, props));
    }
    /** One tool result's meaningful target, or null when it has no visible one. */
    function toolTarget(args) {
      for (const key of ['file_path', 'filePath', 'path', 'filename', 'target_file', 'targetPath', 'command', 'cmd']) {
        const value = args?.[key];
        if (typeof value === 'string' && value.trim() !== '') return { key, value: value.trim() };
      }
      return null;
    }
    /** Parse `call.argsRaw` without trusting its shape. */
    function toolArgs(event) {
      const raw = event?.call?.argsRaw ?? event?.argsRaw;
      if (raw === null || raw === undefined) return {};
      if (typeof raw === 'object') return raw;
      try { return JSON.parse(String(raw)); } catch { return {}; }
    }
    /** Collapse whitespace so a shell command fits one terminal line. */
    function compactText(value, limit = 58) {
      const text = String(value).replace(/\s+/g, ' ').trim();
      return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
    }
    /** Shorten a path to its last two segments so the strip stays readable. */
    function shortPath(value, limit = 46) {
      const text = String(value).split(String.fromCharCode(92)).join('/');
      if (text.length <= limit) return text;
      const parts = text.split('/').filter(Boolean);
      const tail = parts.slice(-2).join('/');
      return tail.length + 2 <= limit ? `…/${tail}` : `…/${parts.slice(-1)[0] ?? text}`;
    }
    /** Fold loaded chat records into the activity-console model. */
    function activityOf(records) {
      const events = Array.isArray(records) ? records : [];
      const files = new Map();
      const lines = [];
      const turns = new Set();
      let tools = 0;
      let prompt = '';
      for (const event of events) {
        if (event?.kind === 'user') {
          const text = (event.blocks ?? []).filter(block => block?.kind === 'text').map(block => block.text).join(' ').trim();
          if (text) prompt = text;
          continue;
        }
        if (typeof event?.turn === 'number') turns.add(event.turn);
        if (event?.kind !== 'tool-result') continue;
        tools += 1;
        const name = event.call?.name ?? event.name ?? 'tool';
        const target = toolTarget(toolArgs(event));
        const fileKeys = ['file_path', 'filePath', 'path', 'filename', 'target_file', 'targetPath'];
        if (target && fileKeys.includes(target.key)) files.set(shortPath(target.value, 40), name);
        const command = target?.key === 'command' || target?.key === 'cmd';
        const display = target ? (command ? compactText(target.value, 58) : shortPath(target.value, 58)) : '';
        const previous = lines[lines.length - 1];
        if (previous && previous.name === name && previous.target === display) previous.time = event.time;
        else lines.push({ seq: event.seq, time: event.time, name, target: display, command, error: event.isError === true });
      }
      return { prompt: prompt.slice(0, 90), lines: lines.slice(-160), files: [...files.entries()].slice(-8), tools, turns: turns.size, records: events.length };
    }
    function clockOf(time) {
      return typeof time === 'number' ? new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    }
    /** Cross-scope activity bus: conversation hooks publish, the sidebar panel reads. */
    const activityBus = { snapshot: Object.freeze({ model: activityOf([]), running: false, hasSession: false }), listeners: new Set() };
    function publishActivity(snapshot) {
      activityBus.snapshot = Object.freeze(snapshot);
      for (const listener of activityBus.listeners) listener();
    }
    function subscribeActivity(listener) {
      activityBus.listeners.add(listener);
      return () => { activityBus.listeners.delete(listener); };
    }
    function useActivity() {
      return useSyncExternalStore(subscribeActivity, () => activityBus.snapshot);
    }
    function Readout(props) {
      const current = useOptions();
      const snapshot = props.useSession ? props.useSession(state => state) : undefined;
      const records = props.useChat ? props.useChat(state => state.legacy?.nodes) : undefined;
      const t = translate(props);
      if (!current.readout || !snapshot) return null;
      const activity = activityOf(records);
      const status = snapshot.removed ? t('removed') : snapshot.lastAgentError ? t('failed') : snapshot.running ? t('running') : t('idle');
      return h('div', { className: 'aic-readout', 'data-running': snapshot.running === true },
        h('span', { className: 'aic-readout-id', title: String(props.sessionId ?? '') }, `SID / ${String(props.sessionId ?? '—').slice(-8)}`),
        h('span', { className: 'aic-readout-state' }, status),
        h('span', null, `${t('turns')} ${activity.turns}`),
        h('span', null, `${t('toolResults')} ${activity.tools}`),
        h('span', null, `${t('files')} ${activity.files.length}`),
        h('span', null, `${t('events')} / ${activity.records}`),
        h('span', { className: 'aic-readout-rule', 'aria-hidden': true }));
    }

    /** Conversation-scoped feeder: publishes the live model into the sidebar panel. */
    function ActivityFeed(props) {
      const snapshot = props.useSession ? props.useSession(state => state) : undefined;
      const records = props.useChat ? props.useChat(state => state.legacy?.nodes) : undefined;
      const todos = typeof props.useProjection === 'function' ? props.useProjection('todos') : undefined;
      const goal = typeof props.useProjection === 'function' ? props.useProjection('goal') : undefined;
      const model = activityOf(records);
      const running = snapshot?.running === true;
      useEffect(() => {
        const hasSession = snapshot !== undefined;
        publishActivity({ model, running, hasSession, sessionId: props.sessionId, todos, goal });
        document.body.dataset.aicActivityOpen = hasSession ? 'on' : 'off';
        return () => { publishActivity({ model: activityOf([]), running: false, hasSession: false }); document.body.removeAttribute('data-aic-activity-open'); };
      }, [records, running, model, snapshot !== undefined, todos, goal]);
      return null;
    }

    /** Full-height activity log on the left, telemetry block in the top-right. */
    function Activity(props) {
      const current = useOptions();
      const t = translate(props);
      const { model, running, hasSession, sessionId, todos, goal: goalProjection } = useActivity();
      const [dock, setDock] = useState(null);
      useEffect(() => {
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
        let frameRequest = 0;
        let resize = null, observedComposer = null;
        const measure = () => {
          frameRequest = 0;
          const frame = document.querySelector('[data-slot="conversation.view"] [class*="_frame"]');
          const root = frame ? frame.querySelector('[class*="_root"]') : null;
          const header = document.querySelector('[data-slot="conversation.header"] > header');
          const tab = document.querySelector('[data-conversation-tabs] button[aria-selected="true"]');
          const chatVisible = frame && root && (!tab || /对话|chat|conversation/i.test(tab.textContent || ''));
          if (!chatVisible) { setDock(null); return; }
          const bounds = frame.getBoundingClientRect();
          const content = frame.querySelector('[data-chat-flow]') ?? root.firstElementChild ?? root;
          const gutter = Math.max(0, content.getBoundingClientRect().left - bounds.left);
          const rightGutter = Math.max(0, bounds.right - content.getBoundingClientRect().right);
          const top = (header ? header.getBoundingClientRect().bottom : bounds.top) + 12;
          if (gutter < 132 || bounds.width < 480) { setDock(null); return; }
          const composer = document.querySelector('[data-composer-card]');
          if (resize && composer !== observedComposer) {
            if (observedComposer) resize.unobserve(observedComposer);
            if (composer) resize.observe(composer);
            observedComposer = composer;
          }
          setDock({
            left: Math.round(bounds.left + 18),
            top: Math.round(top),
            width: Math.round(Math.min(170, gutter - 36)),
            bottom: Math.max(12, Math.round(window.innerHeight - (composer ? composer.getBoundingClientRect().top : window.innerHeight - 12) + 8)),
            cornerRight: Math.round(window.innerWidth - bounds.right + 22),
            missionBottom: 40,
            missionRight: 18,
            missionWidth: Math.min(260, Math.max(0, rightGutter - 36)),
            rightWidth: Math.min(260, Math.max(0, rightGutter - 36)),
          });
        };
        const schedule = () => { if (!frameRequest) frameRequest = requestAnimationFrame(measure); };
        schedule();
        const observers = [];
        if (typeof ResizeObserver === 'function') {
          const observer = new ResizeObserver(schedule);
          resize = observer;
          for (const node of [document.body, document.querySelector('[data-slot="conversation.header"]')]) if (node) observer.observe(node);
          observers.push(observer);
        }
        let mutation = null;
        if (typeof MutationObserver === 'function') {
          mutation = new MutationObserver(schedule);
          mutation.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-aic-activity-open', 'data-aic-sidebar', 'aria-selected'] });
        }
        window.addEventListener('resize', schedule);
        return () => { for (const observer of observers) observer.disconnect(); mutation?.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frameRequest); };
      }, []);
      if (!current.activity || !hasSession) return null;
      const goal = goalProjection?.goal;
      const activeGoal = goal && goal.phase !== 'complete' ? goal : null;
      const lines = model.lines.slice(-80);
      const lastIndex = lines.length - 1;
      return h(React.Fragment, null,
        h('section', {
          className: 'aic-activity',
          'data-running': running,
          'aria-label': t('activity'),
          style: dock ? { left: `${dock.left}px`, top: `${dock.top}px`, bottom: `${dock.bottom}px`, width: `${dock.width}px` } : undefined,
          hidden: dock === null,
        },
          h('div', { className: 'aic-activity-body' },
            lines.length === 0 && h('div', { className: 'aic-activity-line aic-activity-empty' }, t('noActivity')),
            lines.map((line, index) => h('div', {
              key: `${line.seq ?? 'p'}-${index}`,
              className: 'aic-activity-line',
              'data-state': line.error ? 'error' : 'ok',
              'data-latest': index === lastIndex && !line.prompt,
            },
              h('span', { className: 'seq' }, line.seq === undefined ? '' : String(line.seq)),
              h('span', { className: 'prompt' }, line.prompt ? '»' : '$'),
              line.prompt
                ? h('span', { className: 'target' }, line.target)
                : h(React.Fragment, null,
                  h('span', { className: 'tool' }, line.name),
                  line.target && h('span', { className: 'target' }, `${line.command ? ' $ ' : ' → '}${line.target}`)),
              index === lastIndex && h('span', { className: 'aic-activity-cursor', 'aria-hidden': true }))))),
        h('div', {
          className: 'aic-activity-corner',
          'data-running': running,
          hidden: dock === null || dock.rightWidth < 150,
          style: dock ? { right: `${dock.cornerRight}px`, top: `${dock.top}px`, width: `${dock.rightWidth}px` } : undefined,
        },
          h('div', { className: 'aic-activity-corner-head' },
            h('span', null, `${current.titleName} / ACTIVITY`),
            h('span', { className: 'aic-activity-corner-state' }, running ? t('running') : t('idle')),
            sessionId && h('span', null, String(sessionId).slice(-8))),
          h('div', { className: 'aic-activity-corner-counts' },
            h('span', null, t('turns'), ' ', h('b', null, model.turns)),
            h('span', null, t('toolResults'), ' ', h('b', null, model.tools)),
            h('span', null, t('files'), ' ', h('b', null, model.files.length))),
          model.files.length > 0 && h('div', { className: 'aic-activity-corner-files' },
            model.files.slice(0, 4).map(([file], index) => h('span', { key: `${file}-${index}` }, index > 0 ? ' · ' : '', h('b', null, file))))),
        h('div', {
          className: 'aic-mission',
          'data-running': running,
          hidden: dock === null || dock.rightWidth < 150,
          style: dock ? { right: `${dock.missionRight}px`, bottom: `${dock.missionBottom}px`, width: `${dock.missionWidth}px` } : undefined,
        },
          h('div', { className: 'aic-mission-head' },
            h('span', null, `${current.titleName} / MISSION`),
            h('span', { className: 'aic-mission-state' }, running ? t('running') : t('idle'))),
          h('div', { className: 'aic-mission-goal' }, h('span', null, activeGoal?.objective ? 'GOAL' : 'CONTEXT'), h('b', { title: activeGoal?.objective || model.prompt || '' }, activeGoal?.objective || model.prompt || '—')),
          (() => {
            const list = Array.isArray(todos) ? todos : null;
            const inProgress = list ? list.filter(item => item?.status === 'in_progress').length : 0;
            const pending = list ? list.filter(item => item?.status === 'pending').length : 0;
            const completed = list ? list.filter(item => item?.status === 'completed').length : 0;
            const summary = list?.length ? `${inProgress} 进行中 · ${pending} 待处理 · ${completed} 已完成` : todos === undefined ? '任务数据不可用' : '本轮暂无任务';
            const openTasks = list ? [...list.filter(item => item?.status === 'in_progress'), ...list.filter(item => item?.status === 'pending')] : [];
            const tasks = openTasks.slice(0, 4);
            return h(React.Fragment, null,
              h('div', { className: 'aic-mission-plan' }, h('span', null, 'TASK'), h('b', null, summary.slice(0, 96))),
              tasks.map((item, index) => h('div', { key: `task-${index}`, className: 'aic-mission-task' },
                h('i', null, item?.status === 'in_progress' ? '▶' : '·'),
                h('b', { title: String(item?.content ?? '') }, String(item?.content ?? '')), h('em', null, item?.status === 'in_progress' ? '进行中' : '待处理'))),
              openTasks.length > tasks.length && h('div', { className: 'aic-mission-more' }, `另 ${openTasks.length - tasks.length} 项未完成`));
          })(),
          h('div', { className: 'aic-mission-counts' },
            h('span', null, t('turns'), ' ', h('b', null, model.turns)),
            h('span', null, t('toolResults'), ' ', h('b', null, model.tools)),
            h('span', null, t('files'), ' ', h('b', null, model.files.length))),
          model.files.length > 0 && h('div', { className: 'aic-mission-file' }, 'LAST ', h('b', null, model.files[model.files.length - 1][0]))));
    }

    /** Custom slogan rendered at the right edge of the page-tab row. */
    function Slogan(props) {
      const current = useOptions();
      const [slot, setSlot] = useState(null);
      useEffect(() => {
        if (typeof document === 'undefined' || typeof document.querySelector !== 'function') return;
        let frameRequest = 0;
        const measure = () => {
          frameRequest = 0;
          const tabs = document.querySelector('[data-conversation-tabs]');
          if (!tabs || !document.querySelector('[data-slot="conversation.view"]')) { setSlot(null); return; }
          const row = tabs.parentElement?.matches('[class*="_tabs"]') ? tabs.parentElement : tabs;
          const rect = row.getBoundingClientRect();
          const controls = [...row.querySelectorAll('[role="tab"], [class*="_viewsMoreAnchor"]')];
          const occupiedRight = Math.max(tabs.getBoundingClientRect().left, ...controls.map(node => node.getBoundingClientRect().right));
          const maxWidth = Math.min(window.innerWidth * .35, Math.floor(rect.right - occupiedRight - 32));
          if (maxWidth < 120) { setSlot(null); return; }
          setSlot({ right: Math.round(window.innerWidth - rect.right + 8), top: Math.round(rect.top + rect.height / 2), maxWidth });
        };
        const schedule = () => { if (!frameRequest) frameRequest = requestAnimationFrame(measure); };
        schedule();
        window.addEventListener('resize', schedule);
        let observer = null;
        if (typeof MutationObserver === 'function') { observer = new MutationObserver(schedule); observer.observe(document.body, { subtree: true, childList: true }); }
        const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        const header = document.querySelector('[data-slot="conversation.header"]');
        if (header) resize?.observe(header);
        return () => { window.removeEventListener('resize', schedule); observer?.disconnect(); resize?.disconnect(); cancelAnimationFrame(frameRequest); };
      }, []);
      if (!slot || !current.slogan) return null;
      return h('div', { className: 'aic-slogan', style: { right: `${slot.right}px`, top: `${slot.top}px`, maxWidth: `${slot.maxWidth}px` } },
        h('span', { className: 'aic-slogan-mark', 'aria-hidden': true }),
        h('span', { className: 'aic-slogan-text' }, displayTitle(current.slogan)));
    }

    /** Compressed header telemetry: session, monitor state, module toggles and counters. */
    function HeaderTelemetry(props) {
      const current = useOptions();
      const t = translate(props);
      const { model, running, hasSession, sessionId, todos, goal: goalProjection } = useActivity();
      if (!hasSession) return null;
      const toggle = key => () => updateOptions({ ...options, [key]: !options[key] });
      const button = (key, glyph, label) => h('button', {
        type: 'button', className: 'aic-chip-button', 'data-on': current[key], 'aria-pressed': current[key],
        title: label, 'aria-label': label, onClick: toggle(key),
      }, glyph);
      return h('div', { className: 'aic-header-telemetry', 'aria-label': t('activity') },
        h('span', { className: 'aic-chip aic-chip-select', title: String(sessionId ?? '') },
          h('span', { className: 'aic-chip-label' }, 'SYSTEM'), h('b', null, String(sessionId ?? '—').slice(-8))),
        h('span', { className: 'aic-chip aic-chip-monitor', 'data-running': running },
          h('span', { className: 'aic-chip-dot', 'aria-hidden': true }), running ? 'MONITOR ON' : 'MONITOR STBY'),
        h('span', { className: 'aic-chip-group' },
          button('activity', '◫', t('activity')),
          button('effects', '✦', t('effects')),
          button('decoration', '⌗', t('decoration'))),
        h('span', { className: 'aic-chip' }, 'TURNS ', h('b', null, model.turns)),
        h('span', { className: 'aic-chip' }, 'TOOLS ', h('b', null, model.tools)),
        h('span', { className: 'aic-chip' }, 'FILES ', h('b', null, model.files.length)));
    }

    /** Frame-bottom power strip; its running state comes from the body gate. */
    function RunBar() {
      return h('div', { className: 'aic-run-bar', 'aria-hidden': true });
    }

    /** One-shot boot curtain, removed from the tree after it lifts. */
    function Boot() {
      const current = useOptions();
      const [visible, setVisible] = useState(true);
      const [serial, setSerial] = useState(0);
      const [phase, setPhase] = useState('loading');
      const [progress, setProgress] = useState(0);
      const [logs, setLogs] = useState([]);
      useEffect(() => {
        const replay = () => setSerial(value => value + 1);
        window.addEventListener('aic:preview-boot', replay);
        return () => window.removeEventListener('aic:preview-boot', replay);
      }, []);
      useEffect(() => {
          if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches && !options.bootWaitForInput) { setVisible(false); return; }
        let alive = true;
        const timers = new Set();
        let releaseInput = () => {};
        const start = Date.now();
        const delay = ms => new Promise(resolve => { const timer = setTimeout(() => { timers.delete(timer); resolve(); }, ms); timers.add(timer); });
        const record = message => { if (alive) setLogs(items => [...items, { time: String(Date.now() - start).padStart(4, '0'), message }]); };
        setVisible(true); setPhase('loading'); setProgress(0); setLogs([]);
        document.body.setAttribute('data-aic-boot', 'on');
        (async () => {
          record('[INIT] 主题模块已挂载');
          await delay(140); if (!alive) return;
          setProgress(28); record('[STYLE] 视觉令牌与样式已注入');
          await Promise.all([runtime?.harmonyReady, document.fonts?.ready ?? Promise.resolve(), delay(200)]); if (!alive) return;
          setProgress(64); record('[FONT] 字体装载结束');
          while (alive && typeof document.querySelector === 'function' && !document.querySelector('[data-slot="sidebar"], [data-conversation-content]') && Date.now() - start < 4500) await delay(80);
          if (!alive) return;
          const mounted = typeof document.querySelector === 'function' && document.querySelector('[data-slot="sidebar"], [data-conversation-content]');
          setProgress(88); record(mounted ? '[SHELL] 界面挂载完成' : '[SHELL] 保留宿主加载界面');
          await delay(Math.max(0, 1250 - (Date.now() - start))); if (!alive) return;
          setProgress(100); record('[READY] 主题初始化完成'); setPhase('complete');
          await delay(1550); if (!alive) return;
          if (options.bootWaitForInput) {
            setPhase('awaiting');
            await new Promise(resolve => {
              let accepted = false;
              const consume = event => {
                if (event.cancelable) event.preventDefault();
                event.stopPropagation(); event.stopImmediatePropagation();
                  if (event.isComposing || event.repeat) return;
                  if (!accepted && (event.type === 'keyup' || event.type === 'click')) { accepted = true; resolve(); }
              };
              const kinds = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click'];
              for (const kind of kinds) document.addEventListener(kind, consume, true);
              releaseInput = () => { for (const kind of kinds) document.removeEventListener(kind, consume, true); };
            });
            if (!alive) return;
          }
          setPhase('exit');
          await delay(380); if (!alive) return;
          releaseInput(); document.body.removeAttribute('data-aic-boot'); setVisible(false);
        })();
        return () => { alive = false; releaseInput(); for (const timer of timers) clearTimeout(timer); document.body.removeAttribute('data-aic-boot'); };
      }, [serial]);
      if (!visible) return null;
      return h('div', { className: 'aic-boot', 'data-phase': phase, 'data-wait': current.bootWaitForInput, 'data-preview': serial > 0 },
        h('div', { className: 'aic-boot-inner' },
          h('div', { className: 'aic-boot-upper' },
            h('div', { className: 'aic-boot-band', 'aria-hidden': true }),
            h('svg', { className: 'aic-boot-mark', viewBox: '0 0 64 64', fill: 'none', 'aria-hidden': true },
              h('path', { d: 'M32 3 61 32 32 61 3 32Z', stroke: 'currentColor', strokeWidth: 2 })),
            h('h2', { className: 'aic-boot-wordmark' }, current.titleName, phase === 'loading' ? '加载中' : '已就绪'),
            h('div', { className: 'aic-boot-progress', role: 'progressbar', 'aria-label': '界面加载进度', 'aria-valuenow': progress, 'aria-valuemin': 0, 'aria-valuemax': 100 },
              h('i', { className: 'aic-boot-fill', style: { width: `${progress}%` } }))),
          h('div', { className: 'aic-boot-logs', 'aria-hidden': true },
            logs.map((entry, index) => h('div', { key: index }, h('span', null, entry.time), ' ', entry.message))),
          h('div', { className: 'aic-boot-complete', role: 'status', 'aria-live': 'polite' }, phase !== 'loading' ? '加载完成' : ''),
          h('div', { className: 'aic-boot-hint' }, phase === 'awaiting' ? translate()('bootContinue') : '')));
    }

    function effortChoices(state) {
      const route = state?.current;
      if (!route) return null;
      const group = state.groups?.find(item => item.id === route.provider);
      const model = group?.models.find(item => item.id === route.model);
      const reasoning = model?.reasoning;
      if (!reasoning?.efforts?.length) return null;
      return { route, reasoning, options: reasoning.efforts, value: route.reasoningEffort ?? reasoning.defaultEffort };
    }
    function Intensity(props) {
      const current = useOptions();
      const t = translate(props);
      const state = useSyncExternalStore(props.directory.subscribe, props.directory.getSnapshot);
      const session = props.useSession ? props.useSession(snapshot => snapshot) : undefined;
      const [draft, setDraft] = useState(null);
      const [pending, setPending] = useState(false);
      const [error, setError] = useState('');
      const alive = useRef(true);
      const activeRoute = useRef('');
      const busy = useRef(false);
      const data = effortChoices(state);
      const routeKey = data ? `${data.route.provider}/${data.route.model}` : '';
      activeRoute.current = routeKey;
      const index = data?.options.findIndex(item => item.id === data.value) ?? -1;
      useEffect(() => {
        alive.current = true;
        props.load();
        return () => { alive.current = false; };
      }, [props.directory]);
      useEffect(() => { setDraft(null); setError(''); }, [routeKey, data?.value]);
      if (!current.intensity || !props.available || !data || data.options.length < 2) return null;
      // Unknown/provider-default values must remain visible, not silently mapped
      // to the strongest level. The model menu remains the recovery route.
      const known = index >= 0;
      const disabled = !known || pending || state.status === 'selecting' || session?.removed === true || props.locked === true;
      const displayed = draft ?? Math.max(0, index);
      const label = known ? data.options[displayed]?.name ?? data.options[displayed]?.id : t('providerDefault');
      const commit = async value => {
        if (disabled || busy.current || value === index) { setDraft(null); return; }
        const choice = data.options[value];
        if (!choice) return;
        busy.current = true; setPending(true); setError('');
        const requestRoute = routeKey;
        try {
          const result = await props.select({ provider: data.route.provider, model: data.route.model, reasoningEffort: choice.id });
          if (result === false || result?.ok === false) throw new Error(result?.error?.message ?? props.directory.getSnapshot().error ?? t('selectionFailed'));
        } catch (failure) {
          if (alive.current && activeRoute.current === requestRoute) setError(failure?.message ?? t('selectionFailed'));
        } finally {
          busy.current = false;
          if (alive.current) { setPending(false); setDraft(null); }
        }
      };
      return h('div', { className: 'aic-intensity', 'data-disabled': disabled, title: known ? data.options[displayed]?.description : t('providerDefault') },
        h('span', { className: 'aic-intensity-label' }, t('intensityLabel')),
        h('div', { className: 'aic-intensity-shell' },
          h('span', { className: 'aic-intensity-track', 'aria-hidden': true },
            ...Array.from({ length: 28 }, (_, tick) => h('i', { key: tick, className: 'aic-intensity-tick', style: { '--aic-tick-delay': `${tick * 100}ms` }, 'data-lit': known && tick < Math.round(3 + displayed / (data.options.length - 1) * 25) }))),
          h('input', { type: 'range', min: 0, max: data.options.length - 1, step: 1, value: displayed, disabled,
            'aria-label': t('intensityLabel'), 'aria-valuetext': label, 'aria-busy': pending,
            onChange: event => setDraft(Number(event.target.value)),
            onPointerUp: event => { void commit(Number(event.currentTarget.value)); },
            onPointerCancel: () => setDraft(null),
            onBlur: () => setDraft(null),
            onKeyUp: event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) void commit(Number(event.currentTarget.value)); },
          })),
        h('span', { className: 'aic-intensity-value' }, pending ? t('saving') : label),
        error && h('span', { role: 'alert', className: 'aic-intensity-status' }, error));
    }

    const EVENT_GROUPS = ['user', 'assistant', 'tool-result', 'other'];
    function eventGroup(node) { return EVENT_GROUPS.includes(node.kind) ? node.kind : 'other'; }
    function eventsOf(snapshot) {
      const source = snapshot?.nodes ?? snapshot?.chat?.nodes;
      return Array.isArray(source) ? source : [];
    }
    function summaryOf(snapshot) {
      const events = eventsOf(snapshot);
      const counts = Object.fromEntries(EVENT_GROUPS.map(key => [key, 0]));
      const turns = new Map();
      const callTurns = new Map();
      for (const event of events) {
        if (event.kind === 'assistant' && typeof event.turn === 'number') {
          for (const block of event.blocks ?? []) if (block.kind === 'tool-call') callTurns.set(block.callId, event.turn);
        }
      }
      const eventTurns = new Map();
      for (const event of events) {
        counts[eventGroup(event)]++;
        const turnId = typeof event.turn === 'number' ? event.turn : callTurns.get(event.callId);
        if (typeof turnId === 'number') {
          eventTurns.set(event, turnId);
          const turn = turns.get(turnId) ?? { id: turnId, count: 0, error: false };
          turn.count++;
          if (event.kind === 'turn-error' || event.isError === true) turn.error = true;
          turns.set(turnId, turn);
        }
      }
      return { events, counts, eventTurns, turns: [...turns.values()], errors: events.filter(e => e.kind === 'turn-error' || e.isError === true).length };
    }
    function polar(angle, radius) { return [260 + Math.cos(angle) * radius, 165 + Math.sin(angle) * radius]; }
    function arcPath(start, end, radius) {
      const a = polar(start, radius), b = polar(end, radius);
      return `M${a[0]} ${a[1]} A${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} 1 ${b[0]} ${b[1]}`;
    }
    function EventRing({ summary, selected, onSelect, t }) {
      const total = summary.events.length;
      const groups = EVENT_GROUPS.filter(group => summary.counts[group] > 0);
      let offset = -Math.PI / 2;
      const arcs = groups.map(group => {
        const width = summary.counts[group] / Math.max(total, 1) * Math.PI * 2;
        const start = offset; offset += width;
        const gap = Math.min(.025, width * .1);
        return h('path', { key: group, d: arcPath(start + gap, offset - gap, 104), className: 'aic-ring-arc', role: 'button', tabIndex: 0,
          'data-active': selected === group, 'aria-label': `${t(group)}: ${summary.counts[group]}`, 'aria-pressed': selected === group,
          onClick: () => onSelect(selected === group ? null : group),
          onKeyDown: event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(selected === group ? null : group); } },
        });
      });
      // Each ray is a real event, sampled evenly for dense loaded histories.
      // Its length encodes the number of events sharing that turn, not randomness.
      const sample = summary.events.filter((_, i) => i % Math.max(1, Math.ceil(total / 180)) === 0);
      const turnCounts = new Map(summary.turns.map(turn => [turn.id, turn.count]));
      const maxTurn = Math.max(1, ...summary.turns.map(turn => turn.count));
      const rays = sample.map((event, i) => {
        const angle = -Math.PI / 2 + i / Math.max(1, sample.length) * Math.PI * 2;
        const a = polar(angle, 120), b = polar(angle, 124 + (turnCounts.get(summary.eventTurns.get(event)) ?? 1) / maxTurn * 24);
        return h('line', { key: i, x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: 'aic-ring-ray', 'data-active': selected === eventGroup(event) });
      });
      // Only connect actual neighboring events in the same turn. No invented edges.
      const links = sample.slice(1).flatMap((event, i) => {
        const before = sample[i];
        if (!summary.eventTurns.has(event) || summary.eventTurns.get(event) !== summary.eventTurns.get(before)) return [];
        const a = polar(-Math.PI / 2 + i / sample.length * Math.PI * 2, 89);
        const b = polar(-Math.PI / 2 + (i + 1) / sample.length * Math.PI * 2, 89);
        return [h('path', { key: i, d: `M${a[0]} ${a[1]} Q260 165 ${b[0]} ${b[1]}`, className: 'aic-ring-line' })];
      });
      return h('svg', { className: 'aic-ring', viewBox: '0 0 520 330', role: 'group', 'aria-label': t('ringDescription') },
        h('text', { x: 14, y: 24, className: 'aic-ring-label' }, 'SESSION / EVENT FIELD'),
        h('text', { x: 14, y: 314, className: 'aic-ring-label' }, `N / ${total}`),
        ...Array.from({ length: 72 }, (_, i) => {
          const a = polar(i / 72 * Math.PI * 2, 115), b = polar(i / 72 * Math.PI * 2, 117);
          return h('line', { key: `tick${i}`, x1: a[0], y1: a[1], x2: b[0], y2: b[1], className: 'aic-ring-tick' });
        }), ...links, ...arcs, ...rays,
        h('text', { x: 260, y: 160, textAnchor: 'middle', className: 'aic-ring-number' }, total),
        h('text', { x: 260, y: 187, textAnchor: 'middle', className: 'aic-ring-caption' }, t('events')));
    }
    function Analysis(props) {
      useOptions();
      const t = translate(props);
      const snapshot = props.useSession ? props.useSession(state => state) : undefined;
      const records = props.useChat ? props.useChat(state => state.legacy?.nodes) : undefined;
      const [selected, setSelected] = useState(null);
      const summary = React.useMemo(() => summaryOf(Array.isArray(records) ? { nodes: records } : snapshot), [records, snapshot?.nodes, snapshot?.chat?.nodes]);
      if (!snapshot) return h('div', { className: 'aic-analysis-empty' }, t('noData'));
      if (summary.events.length === 0 && snapshot.openState === 'error') return h('div', { className: 'aic-error', role: 'alert' }, String(snapshot.openError?.message ?? t('noData')));
      if (summary.events.length === 0 && (snapshot.openState === 'loading' || snapshot.openState === 'cold')) return h('div', { className: 'aic-analysis-empty', role: 'status' }, t('loading'));
      if (!Array.isArray(records) && !Array.isArray(snapshot.nodes) && !Array.isArray(snapshot.chat?.nodes)) return h('div', { className: 'aic-analysis-empty' }, t('noData'));
      const events = selected ? summary.events.filter(event => eventGroup(event) === selected) : summary.events;
      const metrics = [[t('events'), summary.events.length], [t('turns'), summary.turns.length], [t('toolResults'), summary.counts['tool-result']], [t('errors'), summary.errors]];
      const panel = (title, children, extra) => h('section', { className: 'aic-panel' },
        h('div', { className: 'aic-panel-head' }, h('h3', null, title), extra), children);
      return h('div', { className: 'aic-analysis' },
        h('div', { className: 'aic-analysis-heading' },
          h('div', null, h('div', { className: 'aic-eyebrow' }, displayTitle('AIC / SESSION TELEMETRY')), h('h2', null, t('analysis')), h('p', null, t('loadedWindow'))),
          h('button', { type: 'button', className: 'aic-button', onClick: () => setSelected(null), disabled: selected === null }, t('resetFilter'))),
        snapshot.openError && h('div', { className: 'aic-error', role: 'alert' }, String(snapshot.openError.message ?? t('noData'))),
        h('dl', { className: 'aic-analysis-metrics' }, ...metrics.map(([label, value]) => h('div', { key: label, className: 'aic-analysis-metric' }, h('dt', null, label), h('dd', null, value)))),
        summary.events.length === 0 ? h('div', { className: 'aic-analysis-empty' }, t('noEvents')) : h(React.Fragment, null,
          h('div', { className: 'aic-analysis-main' },
            panel(t('eventField'), h(React.Fragment, null,
              h('div', { className: 'aic-plot' }, h(EventRing, { summary, selected, onSelect: setSelected, t })),
              h('div', { className: 'aic-legend' }, ...EVENT_GROUPS.map(group => h('button', { key: group, type: 'button', 'aria-pressed': selected === group, onClick: () => setSelected(selected === group ? null : group) }, `${t(group)} / ${summary.counts[group]}`))),
              h('p', { className: 'aic-settings-note', style: { padding: '0 12px' } }, t('ringNote')))),
            panel(t('eventFeed'), h('div', { className: 'aic-event-list', tabIndex: 0, 'aria-label': t('eventFeed') },
              ...events.slice(-100).reverse().map((event, i) => h('div', { key: `${event.seq}/${i}`, className: 'aic-event' },
                h('span', { className: 'aic-mono' }, String(event.seq ?? '—')),
                h('span', { className: 'aic-event-copy' }, t(eventGroup(event)), (event.call?.name ?? event.name) ? ` · ${event.call?.name ?? event.name}` : '', event.kind !== eventGroup(event) ? ` · ${event.kind}` : ''),
                h('time', { className: 'aic-mono', dateTime: typeof event.time === 'number' ? new Date(event.time).toISOString() : undefined }, typeof event.time === 'number' ? new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'))),
              events.length === 0 && h('p', null, t('noEvents'))), h('span', { className: 'aic-eyebrow' }, `${Math.min(events.length, 100)} / ${events.length}`))),
          h('div', { className: 'aic-evidence' },
            panel(t('distribution'), h('div', { className: 'aic-evidence-body' }, ...EVENT_GROUPS.map(group => h('div', { key: group, className: 'aic-distribution-row' },
              h('span', null, t(group)), h('div', { className: 'aic-distribution-track', 'aria-hidden': true }, h('div', { className: 'aic-distribution-fill', style: { width: `${summary.counts[group] / Math.max(summary.events.length, 1) * 100}%` } })),
              h('span', { className: 'aic-mono' }, summary.counts[group]))))),
            panel(t('turnIndex'), h('div', { className: 'aic-evidence-body' },
              h('div', { className: 'aic-turn-grid' }, ...summary.turns.slice(-120).map(turn => h('span', { key: turn.id, className: 'aic-turn-cell', 'data-error': turn.error, title: `${t('turns')} ${turn.id} · ${turn.count} ${t('events')}${turn.error ? ` · ${t('failed')}` : ''}` }, turn.id))),
              h('p', { className: 'aic-settings-note' }, t('turnNote')))))));
    }

    function runningSessionKey(snapshot) {
      const ids = [];
      if (typeof snapshot?.entries === 'function') for (const [id, entry] of snapshot.entries()) if (entry?.running === true) ids.push(String(id));
      return ids.sort().join('\u001f');
    }
    function instrumentAnnotations() {
      if (typeof MutationObserver === 'undefined') return () => {};
      const owned = new Map();
      let frame = 0;
      const set = (element, name, value) => {
        if (!element) return;
        let attributes = owned.get(element);
        if (!attributes) owned.set(element, attributes = new Map());
        if (!attributes.has(name)) attributes.set(name, element.getAttribute(name));
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      };
      const restore = (element, name, value) => { if (value === null) element.removeAttribute(name); else element.setAttribute(name, value); };
      const sync = () => {
        frame = 0;
        for (const [element, attributes] of owned) {
          const sidebarAttribute = [...attributes.keys()].some(name => name.startsWith('data-aic-channel') || name.startsWith('data-aic-session-count') || name.startsWith('data-aic-counters'));
          if (!element.isConnected || (!options.sidebar && sidebarAttribute) || (!options.turnRail && attributes.has('data-aic-turn-number'))) {
            for (const [name, value] of attributes) restore(element, name, value);
            owned.delete(element);
          }
        }
        // The visible ordinal lives on the row itself: the instrument layout
        // renders it from the attribute and never fabricates a workspace ID.
        if (options.sidebar) {
          const rows = [...document.querySelectorAll('[data-slot="sidebar.workspaces"] [data-row-key]')];
          const counts = new Map();
          let project = null;
          for (const row of rows) {
            const key = row.getAttribute('data-row-key') ?? '';
            if (key.startsWith('workspace:')) { project = row; counts.set(row, 0); }
            else if (key.startsWith('session:') && project) counts.set(project, (counts.get(project) ?? 0) + 1);
          }
          let ordinal = 0;
          for (const [row, count] of counts) {
            ordinal += 1;
            set(row, 'data-aic-channel', String(ordinal).padStart(2, '0'));
            const text = row.querySelector('[class*="_projectText"]');
            if (text) set(text, 'data-aic-session-count', count > 0 ? String(count) : '');
          }
          const label = document.querySelector('[data-slot="sidebar.workspaces"] [class*="_sectionLabel"]');
          if (label) set(label, 'data-aic-counters', `${counts.size}W / ${[...counts.values()].reduce((total, count) => total + count, 0)}S`);

          // Give the host header groups a stable caption hook (text-based, so
          // host feature reorderings keep working).
          const header = document.querySelector('[data-slot="conversation.header"] [class*="_headerActions"]');
          if (header) {
            const candidates = [...header.querySelectorAll('button, [class*="_label"]:not([class*="_triggerLabel"])')]
              .filter(element => element instanceof HTMLElement && element.offsetParent !== null && (element.textContent || '').trim());
            // Keep the outer control so child labels cannot clip the caption.
            const items = candidates.filter(element => !candidates.some(other => other !== element && other.contains(element)));
            for (const element of items) {
              const text = (element.textContent || '').trim();
              let caption = '';
              if (/后台任务|任务运行/.test(text)) caption = 'BACKGROUND';
              else if (/子智能体/.test(text)) caption = 'AGENTS';
              else if (/创造模式|模式/.test(text)) caption = 'MODE';
              else if (/团队/.test(text)) caption = 'AGENT TEAM';
              if (caption) set(element, 'data-aic-cap', caption);
            }
          }
        }
        if (options.turnRail) document.querySelectorAll('[data-slot="conversation.view"] nav button[data-index][aria-label]').forEach(button => {
          // Read the native absolute turn identity, never data-index + 1 (the
          // loaded history can begin after earlier turns).
          const match = button.getAttribute('aria-label').match(/(?:第\s*|turn\s*)(\d+)/i);
          if (match) set(button, 'data-aic-turn-number', match[1]);
          else if (button.hasAttribute('data-aic-turn-number')) {
            const previous = owned.get(button)?.get('data-aic-turn-number') ?? null;
            restore(button, 'data-aic-turn-number', previous);
            owned.delete(button);
          }
        });
      };
      const schedule = () => { if (!frame) frame = requestAnimationFrame(sync); };
      const observer = new MutationObserver(schedule);
      observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-label', 'aria-expanded'] });
      const unsubscribe = subscribe(schedule);
      sync();
      return () => {
        observer.disconnect(); unsubscribe(); cancelAnimationFrame(frame);
        for (const [element, attributes] of owned) for (const [name, value] of attributes) restore(element, name, value);
        owned.clear();
      };
    }
    function RunAtmosphere(props) {
      const current = useOptions();
      const runKey = props.useSessionStatus ? props.useSessionStatus(runningSessionKey) : '';
      const running = runKey !== '';
      const previous = useRef(runKey);
      const serial = useRef(0);
      const [pulse, setPulse] = useState(null);
      const t = translate(props);
      useEffect(() => {
        if (previous.current === runKey) return;
        const before = new Set(previous.current ? previous.current.split('\u001f') : []);
        const after = new Set(runKey ? runKey.split('\u001f') : []);
        const started = [...after].some(id => !before.has(id));
        previous.current = runKey;
        if (current.runFx) setPulse({ kind: started ? 'start' : 'stop', serial: ++serial.current, preview: false });
      }, [runKey, current.runFx]);
      useEffect(() => {
        const value = document.body.getAttribute('data-aic-running');
        document.body.setAttribute('data-aic-running', running ? 'true' : 'false');
        return () => { if (value === null) document.body.removeAttribute('data-aic-running'); else document.body.setAttribute('data-aic-running', value); };
      }, [running]);
      useEffect(() => {
        const preview = event => {
          if (options.runFx && (event.detail === 'start' || event.detail === 'stop')) setPulse({ kind: event.detail, serial: ++serial.current, preview: true });
        };
        window.addEventListener('aic:preview-run-fx', preview);
        return () => window.removeEventListener('aic:preview-run-fx', preview);
      }, []);
      useEffect(() => {
        if (!pulse) return;
        const timer = setTimeout(() => setPulse(null), 2100);
        return () => clearTimeout(timer);
      }, [pulse]);
      useEffect(() => { if (!current.runFx) setPulse(null); }, [current.runFx]);
      return h(React.Fragment, null,
        running && current.motion && h('div', { className: 'aic-active-field', 'aria-hidden': true }, h('i'), h('i'), h('i')),
        current.runFx && pulse && (() => {
          const telemetry = activityBus.snapshot.model;
          const started = pulse.kind === 'start';
          return h('div', { key: pulse.serial, className: 'aic-run-fx', 'data-kind': pulse.kind, 'data-preview': pulse.preview },
            h('div', { className: 'aic-run-fx-label', role: 'status' },
              h('i', { className: 'aic-run-fx-edge aic-run-fx-edge-l', 'aria-hidden': true }),
              h('i', { className: 'aic-run-fx-edge aic-run-fx-edge-r', 'aria-hidden': true }),
              h('i', { className: 'aic-run-fx-bottom', 'aria-hidden': true }),
              h('div', { className: 'aic-run-fx-logo', 'aria-hidden': true }, h(Mark, { size: 54 })),
              h('span', { className: 'aic-eyebrow' }, pulse.preview ? t('fxPreviewLabel') : (started ? 'AGENT / START' : 'AGENT / STOP')),
              h('strong', null, t(started ? 'agentStarted' : 'agentStopped')),
              h('p', { className: 'aic-run-fx-message' }, t(started ? 'agentStartedMessage' : 'agentStoppedMessage')),
              h('p', { className: 'aic-run-fx-sub' }, t(started ? 'agentStartedSub' : 'agentStoppedSub'))),
            h('div', { className: 'aic-run-fx-diag' },
              h('div', { className: 'aic-run-fx-cell' },
                h('span', null, 'EVENT'),
                h('b', null, started ? 'START' : 'STOP')),
              h('div', { className: 'aic-run-fx-cell' },
                h('span', null, 'INFORMATION'),
                h('b', null, `TURN ${telemetry.turns} · TOOLS ${telemetry.tools} · FILES ${telemetry.files.length}`)),
              h('div', { className: 'aic-run-fx-badge' }, started ? 'RUN' : 'STOP')));
        })());
    }

    function apply(ctx) {
      const locale = ctx.get?.('locale');
      if (locale?.register) ctx.effect(() => locale.register(NS, STRINGS), 'aic: locale');
      const t = locale?.bind?.(NS);
      const owned = { styles: [], previous: new Map(), theme: ctx.theme, palette: null, disposeTokens: null };
      ctx.effect(() => {
        runtime = owned;
        for (const name of ['data-aic-theme', 'data-aic-density', 'data-aic-effects', 'data-aic-scheme', 'data-aic-activity', 'data-aic-activity-open', 'data-aic-center-chat', 'data-aic-sidebar', 'data-aic-sessions', 'data-aic-turn-rail', 'data-aic-decoration', 'data-aic-motion', 'data-aic-run-fx']) owned.previous.set(name, document.body.getAttribute(name));
        document.body.setAttribute('data-aic-theme', '');
        updateOptions(readOptions(), false);
        for (const sheet of STYLES) {
          const tag = document.createElement('style');
          tag.dataset.plugin = ID;
          tag.dataset.pluginCss = `${ID}/${sheet.name}`;
          tag.textContent = sheet.css;
          document.head.append(tag);
          owned.styles.push(tag);
        }
        const titleStyle = document.createElement('style');
        titleStyle.dataset.plugin = ID;
        owned.titleStyle = titleStyle;
        titleStyle.textContent = `body[data-aic-theme]{--aic-title-text:${JSON.stringify(options.titleName)};}`;
        document.head.append(titleStyle); owned.styles.push(titleStyle);
        const storage = event => { if (event.key === STORAGE_KEY || event.key === null) updateOptions(readOptions(), false); };
        window.addEventListener('storage', storage);
        return () => {
          window.removeEventListener('storage', storage);
          for (const tag of owned.styles) tag.remove();
          owned.disposeTokens?.();
          for (const [key, value] of owned.previous) if (value === null) document.body.removeAttribute(key); else document.body.setAttribute(key, value);
          if (runtime === owned) runtime = null;
        };
      }, 'aic: owned styles and body gate');
      ctx.effect(installHarmonyFonts, 'aic: bundled body fonts');
      ctx.effect(instrumentAnnotations, 'aic: instrument annotations');
      ctx.effect(installHeroDotfield, 'aic: hero dotfield');
      ctx.effect(installComposerStrip, 'aic: composer strip');
      function seat(name, id, component, extra = {}) {
        ctx.slots.inject(name, () => ctx.slots.register({ name, id, order: 60, locale: NS, inject: () => t ? { t } : {}, ...extra }, component));
      }
      seat('sidebar.brand.mark', 'aic-mark', Mark, { priority: -50 });
      seat('sidebar.brand.name', 'aic-brand', Brand, { priority: -50 });
      seat('conversation.hero.brand.mark', 'aic-hero-mark', Mark, { priority: -50 });
      seat('conversation.hero.options', 'aic-hero-settings', Settings);
      seat('conversation.session.header.utilities', 'aic-header-telemetry', HeaderTelemetry, { order: 40 });
      seat('conversation.session.header.utilities', 'aic-settings', Settings);
      seat('settings.general.item', 'aic-theme-settings', InlineSettings);
      seat('conversation.composer.dock', 'aic-readout', Readout);
      seat('conversation.composer.dock', 'aic-activity-feed', ActivityFeed);
      seat('shell.overlay', 'aic-activity', Activity);
      seat('shell.overlay', 'aic-slogan', Slogan);
      seat('shell.overlay', 'aic-run-atmosphere', RunAtmosphere);
      seat('shell.overlay', 'aic-run-bar', RunBar);
      seat('shell.overlay', 'aic-boot', Boot);
      installAccount(ctx);
      seat('conversation.view', 'aic-analysis', Analysis, { label: () => t ? t('analysisTab') : options.titleName });
      // This is additive. The host's model picker, effort menu and any parent
      // lock remain intact. No DOM event simulation or direct RPC is involved.
      ctx.inject(['modelDirectories', 'sessions', 'remote', 'remote.session'], scope => {
        scope.slots.inject('conversation.input.left', () => scope.slots.register({
          name: 'conversation.input.left', id: 'aic-intensity', order: 60, locale: NS,
          inject: sessionId => {
            const directory = scope.modelDirectories.directoryFor(sessionId);
            const available = scope.sessions.subagentAddress(sessionId) === undefined;
            return { ...(t ? { t } : {}), available, directory: directory.store,
              load: () => { if (available) directory.load().catch(() => {}); },
              select: selection => available ? directory.select(selection) : Promise.resolve(false),
            };
          },
        }, Intensity));
      });
    }
    /* @hero-dotfield */
    /* @composer-strip */
    /* @harmony-fonts */
    /* @account */
    return { inject: ['theme', 'slots'], apply };
  },
});
