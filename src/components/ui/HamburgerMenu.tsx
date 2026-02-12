'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'
import { HowToPlayModal } from './HowToPlayModal'
import { SettingsModal } from './SettingsModal'

interface HamburgerMenuProps {
  isOpen: boolean
  onClose: () => void
}

export function HamburgerMenu({ isOpen, onClose }: HamburgerMenuProps) {
  const { user, loading, logout } = useAuth()
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setMounted(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
    } else {
      setVisible(false)
      const timer = setTimeout(() => setMounted(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showHowToPlay && !showSettings) {
        onClose()
      }
    },
    [onClose, showHowToPlay, showSettings]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const handleLogout = async () => {
    await logout()
    onClose()
  }

  if (!mounted) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      >
        <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />
      </div>

      <div className={`fixed top-0 right-0 h-full w-64 bg-gray-900 border-l border-gray-800 z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white"
            aria-label="Close menu"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <nav className="mt-8 space-y-4">
            <Link
              href="/game"
              onClick={onClose}
              className="block py-2 text-gray-300 hover:text-white transition-colors"
            >
              Browse Levels
            </Link>

            <button
              onClick={() => setShowHowToPlay(true)}
              className="block w-full text-left py-2 text-gray-300 hover:text-white transition-colors"
            >
              How to Play
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="block w-full text-left py-2 text-gray-300 hover:text-white transition-colors"
            >
              Settings
            </button>

            <div className="border-t border-gray-800 pt-4 mt-4">
              {loading ? (
                <span className="text-gray-400">Loading...</span>
              ) : user ? (
                <div className="space-y-3">
                  <Link
                    href="/profile"
                    onClick={onClose}
                    className="block text-gray-300 hover:text-white transition-colors"
                  >
                    {user.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Link
                    href="/login"
                    onClick={onClose}
                    className="block text-gray-300 hover:text-white transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={onClose}
                    className="block text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>

      <HowToPlayModal
        isOpen={showHowToPlay}
        onClose={() => setShowHowToPlay(false)}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  )
}
