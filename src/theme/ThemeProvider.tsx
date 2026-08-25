import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_KEY as STORAGE_KEY } from "../utils/localStorageKeys";
import { palettes, radii, type Palette, type ThemeName } from "./palettes";
import { applyWebTheme } from "./webTheme";

export type { Palette, ThemeName } from "./palettes";
export { radii } from "./palettes";

type Theme = ThemeName;

interface ThemeContextValue {
  theme: Theme;
  colors: Palette;
  radii: typeof radii;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always initialize dark mode as fallback, matching the web app's
  // behavior of ignoring the persisted value on init (see web ThemeProvider).
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    // Screens read `colors` from context and apply them in their own
    // StyleSheet — there's no DOM/className to toggle here.
    AsyncStorage.setItem(STORAGE_KEY, theme).catch(() => {
      // ignore
    });
  }, [theme]);

  // Web only: the parts of the look that have no React Native expression —
  // the fixed gradient on <body>, the grain over it, and backdrop-filter on
  // glass surfaces. No-op on native, where AppBackground draws the gradient
  // with react-native-svg instead. See webTheme.ts.
  useEffect(() => {
    applyWebTheme(theme);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{ theme, colors: palettes[theme], radii, toggleTheme, setTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

export default ThemeProvider;
