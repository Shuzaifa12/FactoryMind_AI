"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import en from "./en.json";
import ur from "./ur.json";

export type Locale = "en" | "ur";
export const LOCALES: Locale[] = ["en", "ur"];
export const STORAGE_KEY = "fm-locale";

type Messages = typeof en;
type Paths<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type MessageKey = Paths<Messages>;

const catalogs: Record<Locale, Messages> = { en, ur };

export function directionOf(locale: Locale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}

export function lookup(locale: Locale, key: string): string {
  let node: unknown = catalogs[locale];
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return key;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : key;
}

function applyToDocument(locale: Locale) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = locale;
    document.documentElement.dir = directionOf(locale);
  }
}

type I18nValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (l: Locale) => void;
  t: (key: MessageKey | string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === "undefined") return "en";
    try {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return v === "ur" || v === "en" ? v : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    applyToDocument(locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    setLocaleState(l);
    applyToDocument(l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: directionOf(locale),
      setLocale,
      t: (key: string) => lookup(locale, key),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
