import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "../locales/en/translation.json";
import sv from "../locales/sv/translation.json";
import fr from "../locales/fr/translation.json";

const resources = {
  en: { translation: en },
  sv: { translation: sv },
  fr: { translation: fr },
};

const LANG_STORAGE_KEY = "wordlune:lang";

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

// Mirrors the web app's detector config: only ever restore a language the
// user explicitly picked before (cached), never auto-detect the device
// locale — new users default to English.
AsyncStorage.getItem(LANG_STORAGE_KEY).then((cached) => {
  if (cached && cached in resources) {
    i18n.changeLanguage(cached);
  }
});

i18n.on("languageChanged", (lng) => {
  AsyncStorage.setItem(LANG_STORAGE_KEY, lng).catch(() => {
    // ignore
  });
});

export default i18n;
