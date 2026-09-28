import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import lt from "./locales/lt.json";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES } from "../constants/languages";

// Namespaces by area: "common" (generic words), "app" (shell chrome, modals), "library" (viewer
// overlays and previews), "models" (Models page, model detail, author page).
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en.common, app: en.app, library: en.library, models: en.models },
      lt: { common: lt.common, app: lt.app, library: lt.library, models: lt.models },
    },
    ns: ["common", "app", "library", "models"],
    defaultNS: "common",
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
  });

export default i18n;
