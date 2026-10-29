import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations, LANGS } from '../data/translations.js';

const STORAGE_KEY = 'vanraj-portfolio-lang';
const LanguageContext = createContext(null);

function getInitialLang() {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return LANGS.includes(stored) ? stored : 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage unavailable (private mode, etc.) — safe to ignore
    }
    document.documentElement.lang = lang === 'gu' ? 'gu' : 'en';
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      t: translations[lang],
      toggleLang: () => setLang((prev) => (prev === 'en' ? 'gu' : 'en')),
      setLang,
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
