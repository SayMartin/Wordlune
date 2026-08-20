import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { THEME_KEY as STORAGE_KEY } from "../utils/localStorageKeys";

type Theme = "light" | "dark";

interface Palette {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
}

const palettes: Record<Theme, Palette> = {
  dark: {
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    border: "#334155",
    accent: "#22c55e",
  },
  light: {
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#0f172a",
    textMuted: "#475569",
    border: "#e2e8f0",
    accent: "#16a34a",
  },
};

interface ThemeContextValue {
  theme: Theme;
  colors: Palette;
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

  const setTheme = (t: Theme) => {
    setThemeState(t);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider
      value={{ theme, colors: palettes[theme], toggleTheme, setTheme }}
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
