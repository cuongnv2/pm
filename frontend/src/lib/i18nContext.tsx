"use client";

import { createContext, useContext, useState } from "react";
import { translations, type Lang, type Translations } from "@/lib/i18n";

type LangContextValue = {
  lang: Lang;
  t: Translations;
  toggleLang: () => void;
};

const LangContext = createContext<LangContextValue>({
  lang: "en",
  t: translations.en,
  toggleLang: () => {},
});

export const LangProvider = ({ children }: { children: React.ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("lang") as Lang) || "en";
    }
    return "en";
  });

  const toggleLang = () => {
    const next: Lang = lang === "en" ? "vi" : "en";
    setLang(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("lang", next);
    }
  };

  return (
    <LangContext.Provider value={{ lang, t: translations[lang], toggleLang }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
