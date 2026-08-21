import { Platform, Share } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GAME_STATE_KEY, DEVICE_PREFERENCE_KEYS } from "./localStorageKeys";

export type SaveOutcome = "downloaded" | "shared" | "copied";

/**
 * The wordlune:* keys, for inclusion in the data export. Art. 20 covers data
 * the user provided, and their theme/language/reduce-motion choices qualify —
 * they're trivially available, so there's no reason to withhold them.
 *
 * The Supabase session token is deliberately NOT included: it's a live
 * credential, not user data, and writing it into a file the user then emails
 * around would be actively harmful.
 */
export async function readDeviceSettings(): Promise<Record<string, string | null>> {
  const keys = [...DEVICE_PREFERENCE_KEYS, GAME_STATE_KEY];
  const out: Record<string, string | null> = {};
  try {
    for (const key of keys) {
      out[key] = await AsyncStorage.getItem(key);
    }
  } catch {
    // Best-effort: a failed local read shouldn't sink the whole export.
  }
  return out;
}

export function exportFilename(): string {
  return `wordlune-data-${new Date().toISOString().slice(0, 10)}.json`;
}

/**
 * Hands the finished JSON to the user as a file.
 *
 * Web and native need genuinely different mechanisms — react-native-web's
 * Share.share() delegates to navigator.share and rejects outright when that
 * isn't available, so it is not a usable web path and the Blob route is not
 * merely a nicety.
 */
export async function saveJsonExport(filename: string, json: string): Promise<SaveOutcome> {
  if (Platform.OS === "web") {
    // Reached through `globalThis` rather than the bare globals because this
    // project's tsconfig has no "dom" lib — adding it would make every native
    // file believe document/window exist. Same approach as AuthContext's
    // `(globalThis as any).window`.
    const g = globalThis as any;
    const blob = new g.Blob([json], { type: "application/json" });
    const url = g.URL.createObjectURL(blob);
    try {
      const a = g.document.createElement("a");
      a.href = url;
      a.download = filename;
      g.document.body.appendChild(a);
      a.click();
      g.document.body.removeChild(a);
    } finally {
      // Revoking immediately can race the download in some browsers; a short
      // delay is the conventional guard.
      setTimeout(() => g.URL.revokeObjectURL(url), 10000);
    }
    return "downloaded";
  }

  // Native: write to the cache directory, then offer the OS share sheet so the
  // user picks where it goes (Files, Drive, mail, ...). Imported lazily so the
  // web bundle never pulls in the native modules.
  try {
    const { File, Paths } = require("expo-file-system");
    const Sharing = require("expo-sharing");

    const file = new File(Paths.cache, filename);
    file.write(json);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
        dialogTitle: filename,
      });
      return "shared";
    }
  } catch (e) {
    console.error("saveJsonExport: file/share path failed, falling back", e);
  }

  // Last resort. Note a large export may be truncated by whatever app receives
  // it — that's precisely why the file path above is preferred.
  await Share.share({ message: json });
  return "copied";
}
