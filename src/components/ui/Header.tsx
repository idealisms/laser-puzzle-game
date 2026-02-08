'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HamburgerMenu } from './HamburgerMenu'

interface HeaderProps {
  rightContent?: React.ReactNode
}

export function Header({ rightContent }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-emerald-400">
            Laser Puzzle
          </Link>

          <div className="flex items-center gap-4">
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

      <HamburgerMenu isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
