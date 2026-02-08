'use client'

import { useEffect, useCallback } from 'react'

interface HowToPlayModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HowToPlayModal({ isOpen, onClose }: HowToPlayModalProps) {
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
        <h2 className="text-2xl font-bold mb-4">How to Play</h2>
        <ul className="text-gray-400 space-y-3">
          <li className="flex">
            <span className="text-emerald-400 mr-3 font-semibold">1.</span>
            <span>Click on a cell to cycle through mirrors: / → \ → empty</span>
          </li>
          <li className="flex">
            <span className="text-emerald-400 mr-3 font-semibold">2.</span>
            <span>Mirrors reflect the laser beam at 90° angles</span>
          </li>
          <li className="flex">
            <span className="text-emerald-400 mr-3 font-semibold">3.</span>
            <span>Create the longest laser path possible!</span>
          </li>
        </ul>
        <button
          onClick={onClose}
          className="mt-6 w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md transition-colors"
        >
          Got it!
        </button>
      </div>
    </div>
  )
}
