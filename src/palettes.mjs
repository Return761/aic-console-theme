/**
 * Palette accents. Surfaces, borders and text live in `palette.json` and are
 * shared by every scheme: switching a scheme changes the accent pair, never
 * the canvas.
 *
 * Each scheme keeps two theme colours:
 *   accent — current row, focus, state lines, primary actions;
 *   action — the secondary identity colour (thinking scale, hollow diamonds,
 *            technical values). It is exposed as the custom `--aic-action`
 *            token so semantic warning colours stay semantic.
 */

/** Two colours per scheme per mode. Everything else is neutral. */
export const SCHEME_COLORS = {
  teal: {
    dark: { accent: '#86AFA8', action: '#C7AE7C' },
    light: { accent: '#2F6B64', action: '#7A5C22' },
  },
  oxide: {
    dark: { accent: '#AA2827', action: '#CBB383' },
    light: { accent: '#AA2827', action: '#8A5F2A' },
  },
  ultraviolet: {
    dark: { accent: '#A796C9', action: '#93B7DA' },
    light: { accent: '#5F5389', action: '#2F6475' },
  },
};

/** Tokens that a scheme is allowed to rewrite. */
export const ACCENT_TOKENS = [
  '--dsw-alias-brand-primary',
  '--dsw-alias-state-business-primary',
  '--dsw-alias-button-info-fill',
  '--dsw-alias-button-primary-hover',
  '--dsw-alias-button-info-hover',
  '--dsw-alias-state-business-tertiary',
  '--dsw-alias-interactive-bg-hover',
  '--dsw-alias-interactive-bg-active',
  '--dsw-alias-interactive-bg-hover-accent',
  '--dsw-alias-button-primary-dimmed',
  '--aic-action',
];
// Text on a solid accent must adapt when an exact darker accent is requested.
export const CONTRAST_TOKENS = ['--dsw-alias-brand-primary-invert'];

const clamp = value => Math.max(0, Math.min(255, Math.round(value)));

/** Parse `#rrggbb` (or `#rrggbbaa`, alpha dropped) into channels. */
function channels(hex) {
  const value = hex.slice(1, 7);
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
}

/** Mix two opaque colours; `amount` is the weight of `target`. */
function mix(base, target, amount) {
  const a = channels(base);
  const b = channels(target);
  return `#${a.map((channel, index) => clamp(channel + (b[index] - channel) * amount).toString(16).padStart(2, '0')).join('')}`;
}

/** Rebuild every token layer from the neutral base plus one scheme accent pair. */
export function buildPalettes(base) {
  const out = {};
  for (const [name, modes] of Object.entries(SCHEME_COLORS)) {
    const tokens = structuredClone(base);
    const set = (key, mode, value) => {
      tokens[key] ??= {};
      tokens[key][mode] = value;
    };
    for (const mode of ['dark', 'light']) {
      const accent = modes[mode].accent;
      const action = modes[mode].action;
      const light = mode === 'light';
      const hover = mix(accent, light ? '#000000' : '#FFFFFF', light ? 0.12 : 0.10);
      const dimmed = mix(accent, light ? '#FBFBFB' : '#0B0C0C', light ? 0.55 : 0.62);
      set('--dsw-alias-brand-primary', mode, accent);
      const rgb = channels(accent).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      const luminance = rgb.reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      set('--dsw-alias-brand-primary-invert', mode, luminance < .179 ? '#FBFBFB' : '#0B0C0C');
      set('--dsw-alias-state-business-primary', mode, accent);
      set('--dsw-alias-button-info-fill', mode, accent);
      set('--dsw-alias-button-primary-hover', mode, hover);
      set('--dsw-alias-button-info-hover', mode, hover);
      set('--dsw-alias-button-primary-dimmed', mode, dimmed);
      // The secondary identity colour is a plugin token, not a warning alias.
      set('--aic-action', mode, action);
      // Tints stay at hairline strength so an accent marks state without
      // tinting a whole surface.
      set('--dsw-alias-state-business-tertiary', mode, `${accent}${light ? '16' : '1F'}`);
      set('--dsw-alias-interactive-bg-hover', mode, `${accent}${light ? '0A' : '0D'}`);
      set('--dsw-alias-interactive-bg-active', mode, `${accent}${light ? '12' : '1A'}`);
      set('--dsw-alias-interactive-bg-hover-accent', mode, `${accent}${light ? '0D' : '12'}`);
    }
    out[name] = { tokens };
  }
  return out;
}
