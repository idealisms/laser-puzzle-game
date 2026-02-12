'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

interface Settings {
  showBlipAnimations: boolean
  colorblindMode: boolean
}

const DEFAULT_SETTINGS: Settings = {
  showBlipAnimations: true,
  colorblindMode: false,
}

const STORAGE_KEY = 'laser-puzzle-settings'

interface SettingsContextValue {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) })
      }
    } catch {
      // ignore malformed data
    }
  }, [])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // storage full or unavailable
      }
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
