"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

type Language = "en" | "hi"

interface LanguageContextType {
  language: Language
  toggleLanguage: () => void
  t: (en: string, hi: string) => string
}

const defaultContext: LanguageContextType = {
  language: "hi",
  toggleLanguage: () => {},
  t: (en: string, hi: string) => hi
}

const LanguageContext = createContext<LanguageContextType>(defaultContext)

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>("hi")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "hi" : "en"))
  }

  const t = (en: string, hi: string) => {
    return language === "en" ? en : `${en} (${hi})`
  }

  const contextValue = mounted ? { language, toggleLanguage, t } : defaultContext

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  return context
}
