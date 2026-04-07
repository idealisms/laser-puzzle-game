'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HamburgerMenu } from './HamburgerMenu'
import { HowToPlayModal } from './HowToPlayModal'
import { SettingsModal } from './SettingsModal'
import { AboutModal } from './AboutModal'

interface HeaderProps {
  rightContent?: React.ReactNode
  subtitle?: string
  dailySiteUrl?: string
  dailySiteName?: string
}

export function Header({ rightContent, subtitle, dailySiteUrl, dailySiteName }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)

  return (
    <>
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <Link href="/" className="text-xl font-bold text-emerald-400">
              Laser Puzzle
            </Link>
            {subtitle && (
              <div className="text-xs text-gray-500 mt-0.5">{subtitle}</div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {dailySiteUrl && (
              <a
                href={dailySiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {dailySiteName ?? 'Play daily game'} &rarr;
              </a>
            )}

            {rightContent && (
              <div className="text-gray-400">{rightContent}</div>
            )}

            <button
              onClick={() => setMenuOpen(true)}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <HamburgerMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onOpenHowToPlay={() => setShowHowToPlay(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenAbout={() => setShowAbout(true)}
      />

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <AboutModal
        isOpen={showAbout}
        onClose={() => setShowAbout(false)}
      />
    </>
  )
}
