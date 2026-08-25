/**
 * The palette, shared with appfinningar.se.
 *
 * Wordlune lives on wordlune.appfinningar.se and has a card on that site's
 * front page — the two are one family, not two brands, so they use the same
 * colours and the same shapes. The dark values below are lifted straight from
 * appfinningar-se's `src/styles/global.css` custom properties; when that file
 * changes, this one should follow.
 *
 * Two things deliberately do NOT come from there:
 *
 * 1. The board and keyboard tile colours (BoardGrid.tsx / Keyboard.tsx) stay
 *    Wordle's green/yellow/grey. Those aren't decoration — they're the rules of
 *    the game, and everyone who has played a Wordle already reads them.
 *
 * 2. Light mode is flat. appfinningar.se is dark-only on purpose ("halvtrans-
 *    parenta kort bygger på att det finns något mörkt bakom glaset"), which is
 *    true — so light mode here keeps the same hues but drops the transparency
 *    entirely, rather than rendering the glass as grey plates.
 */

export type ThemeName = "light" | "dark";

export interface Palette {
  /** Page base. On dark this is the top of the gradient AppBackground paints. */
  background: string;
  backgroundMid: string;
  backgroundDeep: string;

  /**
   * The standard card/panel fill. Translucent on dark (it picks up the glow
   * behind it), solid on light. Anything that must not show through — a
   * dropdown, a modal, a sticky bar with content passing under it — wants
   * `surfaceSolid` instead.
   */
  surface: string;
  surfaceSolid: string;
  surfaceHover: string;
  /** Inputs and wells: reads as pressed into the surface rather than raised. */
  surfaceSunken: string;

  border: string;
  borderHover: string;
  /**
   * Neutral fill for the "off" half of a control — the unlit part of a switch
   * track. Deliberately stronger than `border` and `surfaceHover`: it has to
   * read as a real object on top of the glass, not as a hairline.
   */
  controlTrack: string;

  text: string;
  textMuted: string;
  textFaint: string;
  /** Text/icons drawn on top of a filled accent or status colour. */
  onAccent: string;

  accent: string;
  accentHover: string;
  /** The second half of the brand gradient — never used on its own for text. */
  accent2: string;
  /** Tinted fill for a selected chip or an active row. */
  accentSoft: string;

  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
}

export const palettes: Record<ThemeName, Palette> = {
  dark: {
    background: "#0d1533",
    backgroundMid: "#1b1442",
    backgroundDeep: "#070c1c",

    surface: "rgba(255, 255, 255, 0.042)",
    // Opaque stand-in for `surface` composited over `background`, for the
    // places transparency would leak content through.
    surfaceSolid: "#141c3c",
    surfaceHover: "rgba(255, 255, 255, 0.068)",
    surfaceSunken: "rgba(0, 0, 0, 0.24)",

    border: "rgba(255, 255, 255, 0.09)",
    borderHover: "rgba(91, 157, 255, 0.45)",
    controlTrack: "rgba(255, 255, 255, 0.16)",

    text: "#eaf1fc",
    textMuted: "#9fb2d0",
    textFaint: "#6b7ea3",
    onAccent: "#ffffff",

    accent: "#3d8bfd",
    accentHover: "#5b9dff",
    accent2: "#8b6cff",
    accentSoft: "rgba(61, 139, 253, 0.14)",

    // Status hues are the light-mode ones lifted a few steps: #16a34a and
    // #dc2626 are legible on white but nearly vanish on #0d1533.
    success: "#34d399",
    successSoft: "rgba(52, 211, 153, 0.14)",
    danger: "#f87171",
    dangerSoft: "rgba(248, 113, 113, 0.14)",
    warning: "#fbbf24",
    warningSoft: "rgba(251, 191, 36, 0.14)",
    info: "#60a5fa",
    infoSoft: "rgba(96, 165, 250, 0.14)",
  },

  light: {
    background: "#f4f6fb",
    backgroundMid: "#eef1fa",
    backgroundDeep: "#e7ecf7",

    surface: "#ffffff",
    surfaceSolid: "#ffffff",
    surfaceHover: "#f2f5fc",
    surfaceSunken: "#f1f4fa",

    border: "#dae1ef",
    borderHover: "#1f6fe0",
    controlTrack: "#d5dbe9",

    text: "#0f1a3a",
    textMuted: "#55627e",
    textFaint: "#8492ad",
    onAccent: "#ffffff",

    // Darker than dark mode's accent: #3d8bfd on white is around 3:1, which
    // fails for body-sized link text.
    accent: "#1f6fe0",
    accentHover: "#1a5cbd",
    accent2: "#6d4fe8",
    accentSoft: "rgba(31, 111, 224, 0.10)",

    success: "#15803d",
    successSoft: "rgba(21, 128, 61, 0.10)",
    danger: "#c02626",
    dangerSoft: "rgba(192, 38, 38, 0.09)",
    warning: "#b45309",
    warningSoft: "rgba(180, 83, 9, 0.10)",
    info: "#1f6fe0",
    infoSoft: "rgba(31, 111, 224, 0.10)",
  },
};

/** Shapes, shared across both themes — appfinningar.se's `--radius: 14px`. */
export const radii = {
  sm: 8,
  md: 14,
  lg: 18,
  pill: 999,
} as const;
