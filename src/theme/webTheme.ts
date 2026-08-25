import { Platform } from "react-native";
import { palettes, type ThemeName } from "./palettes";

const STYLE_ELEMENT_ID = "wordlune-theme";

/**
 * The three pieces of appfinningar.se's look that React Native has no way to
 * express, injected as real CSS on the web target only:
 *
 *   1. Several `radial-gradient`s layered on one element. RN style accepts one
 *      background colour, and react-native-svg (which draws the same gradient
 *      on native, see AppBackground.tsx) can't be attached to <body>.
 *   2. `background-attachment: fixed`. The glow has to stay put while the page
 *      scrolls — that's what gives the translucent cards something moving to
 *      read against. There is no RN equivalent at all.
 *   3. `backdrop-filter`. Applied through the `data-wl-glass` attribute, which
 *      react-native-web renders from a View's `dataSet` prop.
 *
 * Why this goes on <body> rather than into an absolutely-positioned View: the
 * grain and the glow must sit behind *everything*, including React Navigation's
 * own scene containers, and painting them at the document level is the one
 * place nothing can end up on top of by accident. It does mean the navigation
 * theme's background has to be transparent — see App.tsx.
 */
function css(theme: ThemeName): string {
  const c = palettes[theme];

  // Light mode is flat by design (see palettes.ts): same hues, no glow, no
  // grain, no backdrop-filter — translucent cards over a pale background just
  // read as grey plates, and there is nothing behind them worth blurring.
  if (theme === "light") {
    return `
html { background: ${c.backgroundDeep}; }
body {
  background: ${c.background};
  background-attachment: fixed;
}
[data-wl-glass] { backdrop-filter: none; -webkit-backdrop-filter: none; }
[data-wl-gradient-text] {
  background: linear-gradient(175deg, ${c.text} 8%, ${c.textMuted} 92%);
  -webkit-background-clip: text;
  background-clip: text;
  /* !important because react-native-web writes the color as an inline style
     on the element, and an inline colour beats a stylesheet rule every time. */
  color: transparent !important;
  -webkit-text-fill-color: transparent;
}
`;
  }

  return `
html { background: ${c.backgroundDeep}; }
body {
  background:
    radial-gradient(60rem 42rem at 10% -10%, rgba(61, 139, 253, .20), transparent 62%),
    radial-gradient(48rem 36rem at 94% 6%, rgba(139, 108, 255, .17), transparent 60%),
    radial-gradient(70rem 50rem at 50% 46%, rgba(112, 62, 178, .14), transparent 68%),
    linear-gradient(180deg, ${c.background} 0%, ${c.backgroundMid} 46%, ${c.backgroundDeep} 100%);
  background-attachment: fixed;
  background-color: ${c.backgroundDeep};
}

/* Grain over the whole page. Large soft gradients band visibly on 8-bit
   displays; the noise breaks the bands up. Behind all content, catches no
   clicks. Same SVG turbulence appfinningar.se uses. */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  opacity: .32;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.42'/%3E%3C/svg%3E");
}
/* #root would otherwise sit at the same stacking level as the grain and lose
   the tie-break, putting the noise on top of the UI instead of under it. */
#root { position: relative; z-index: 1; }

[data-wl-glass] {
  -webkit-backdrop-filter: blur(14px) saturate(140%);
  backdrop-filter: blur(14px) saturate(140%);
}

/* Heading fill: near-white at the top, duller at the bottom. Depth without
   showing off — appfinningar.se's h1 treatment. */
[data-wl-gradient-text] {
  background: linear-gradient(175deg, #ffffff 8%, #b9caea 92%);
  -webkit-background-clip: text;
  background-clip: text;
  /* !important because react-native-web writes the color as an inline style
     on the element, and an inline colour beats a stylesheet rule every time. */
  color: transparent !important;
  -webkit-text-fill-color: transparent;
}

/* Rörelse är utsmyckning — den som stängt av den ska slippa. Mirrors both
   appfinningar.se's global rule and this app's own reduceMotion setting. */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;
}

/** No-op off web. Safe to call on every theme change; it rewrites in place. */
export function applyWebTheme(theme: ThemeName): void {
  if (Platform.OS !== "web") return;

  // Reached through `globalThis` rather than the bare global because this
  // project's tsconfig has no "dom" lib — adding it would make every native
  // file believe document/window exist. Same approach as exportDownload.ts.
  const doc = (globalThis as any).document;
  if (!doc) return;

  let el = doc.getElementById(STYLE_ELEMENT_ID);
  if (!el) {
    el = doc.createElement("style");
    el.id = STYLE_ELEMENT_ID;
    doc.head.appendChild(el);
  }
  el.textContent = css(theme);

  // Keeps the browser's own chrome (mobile Safari's toolbar, Chrome's tab
  // strip on Android) in step with the page instead of leaving the boot-time
  // value from index.html behind after a theme switch.
  const meta = doc.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", palettes[theme].background);
}

/**
 * Spread onto a View to make it a glass surface on web. Renders as
 * `data-wl-glass="true"`; ignored entirely on native, where the blur is
 * skipped on purpose — the background there is a static gradient, so blurring
 * it produces the gradient back, at real cost on Android.
 */
export const glassProps =
  Platform.OS === "web" ? ({ dataSet: { wlGlass: "true" } } as const) : ({} as const);
