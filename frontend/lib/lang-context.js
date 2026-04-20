'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const LangContext = createContext({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState('en');

  useEffect(() => {
    const saved = localStorage.getItem('crm_lang');
    if (saved === 'en' || saved === 'es') setLangState(saved);
  }, []);

  const setLang = (l) => {
    setLangState(l);
    localStorage.setItem('crm_lang', l);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
