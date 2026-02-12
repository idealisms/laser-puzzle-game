'use client'

import { Modal } from './Modal'
import { useSettings } from '@/context/SettingsContext'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings()

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings">
      <div className="space-y-4">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-gray-300">Laser blip animations</span>
          <button
            role="switch"
            aria-checked={settings.showBlipAnimations}
            onClick={() => updateSettings({ showBlipAnimations: !settings.showBlipAnimations })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.showBlipAnimations ? 'bg-emerald-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                settings.showBlipAnimations ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-gray-300">High contrast mode</span>
            <p className="text-xs text-gray-500">Blue &amp; orange palette</p>
          </div>
          <button
            role="switch"
            aria-checked={settings.colorblindMode}
            onClick={() => updateSettings({ colorblindMode: !settings.colorblindMode })}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              settings.colorblindMode ? 'bg-emerald-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                settings.colorblindMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </Modal>
  )
}
