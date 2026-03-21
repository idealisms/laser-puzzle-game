'use client'

import { useEffect, useCallback } from 'react'

interface AboutModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AboutModal({ isOpen, onClose }: AboutModalProps) {
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

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold mb-4">About</h2>

        <p className="text-gray-300 mb-4">
          Laser Puzzle was inspired by{' '}
          <a href="https://adventofcode.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">Advent of Code</a>
          ,{' '}
          <a href="https://leetcode.com" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">LeetCode</a>
          , and{' '}
          <a href="https://enclose.horse" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">enclose.horse</a>
          .
        </p>

        <p className="text-gray-300 mb-4">
          The source code is available on{' '}
          <a href="https://github.com/idealisms/laser-puzzle-game" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">GitHub</a>
          .
        </p>

        <p className="text-gray-300">
          If you have feedback or suggestions on this game and want to get in touch with me (Tony Chang), join the{' '}
          <a href="https://discord.gg/3EeWNbZYXD" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">Discord server</a>
          .
        </p>
      </div>
    </div>
  )
}
