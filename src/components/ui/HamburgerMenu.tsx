'use client'

import { useEffect, useCallback, useState } from 'react'
import Link from 'next/link'

interface HamburgerMenuProps {
  isOpen: boolean
  onClose: () => void
  onOpenHowToPlay: () => void
  onOpenSettings: () => void
}

export function HamburgerMenu({ isOpen, onClose, onOpenHowToPlay, onOpenSettings }: HamburgerMenuProps) {
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
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-40"
      onClick={onClose}
    >
      <div className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} />

      <div
        className={`absolute top-0 right-0 h-full w-64 bg-gray-900 border-l border-gray-800 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        onClick={(e) => e.stopPropagation()}
      >
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
              onClick={() => { onClose(); onOpenHowToPlay() }}
              className="block w-full text-left py-2 text-gray-300 hover:text-white transition-colors"
            >
              How to Play
            </button>

            <button
              onClick={() => { onClose(); onOpenSettings() }}
              className="block w-full text-left py-2 text-gray-300 hover:text-white transition-colors"
            >
              Settings
            </button>

            <a
              href="https://discord.gg/3EeWNbZYXD"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-2 py-2 text-gray-300 hover:text-white transition-colors"
            >
              {/* Discord logo */}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 127.14 96.36" fill="currentColor">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Discord
            </a>
          </nav>
        </div>
      </div>
    </div>
  )
}
