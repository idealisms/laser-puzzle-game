'use client'

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react'

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

// Settings live in localStorage. useSyncExternalStore reads them on the client
// while the server (and hydration) render with the defaults.
const listeners = new Set<() => void>()
let cachedRaw: string | null = null
let cachedSettings: Settings = DEFAULT_SETTINGS
// Set when localStorage can't be written, so changes still apply for this session.
let unsavedSettings: Settings | null = null

function readSettings(): Settings {
  if (unsavedSettings) return unsavedSettings
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // storage unavailable
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw
    try {
      cachedSettings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
    } catch {
      cachedSettings = DEFAULT_SETTINGS // ignore malformed data
    }
  }
  return cachedSettings
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function updateSettings(patch: Partial<Settings>) {
  const next = { ...readSettings(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    unsavedSettings = next // storage full or unavailable
  }
  listeners.forEach((l) => l())
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(subscribe, readSettings, () => DEFAULT_SETTINGS)

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
