import { createContext, useContext } from 'react'
import type { Language, Translations } from './locales'
import { translations } from './locales'

type TFn = (key: keyof Translations) => string

interface I18nContextValue {
  t: TFn
  language: Language
}

const I18nContext = createContext<I18nContextValue>({
  t: (key) => translations.en[key],
  language: 'en',
})

export function I18nProvider({
  language,
  children,
}: {
  language: Language
  children: React.ReactNode
}): JSX.Element {
  const t: TFn = (key) => translations[language]?.[key] ?? translations.en[key]
  return <I18nContext.Provider value={{ t, language }}>{children}</I18nContext.Provider>
}

/** Returns the translation function for the current language. */
export function useT(): TFn {
  return useContext(I18nContext).t
}

/** Returns the current active language code. */
export function useLanguage(): Language {
  return useContext(I18nContext).language
}
