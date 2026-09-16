'use client'

import { useRef, useState } from 'react'

interface CompactSidebarProps {
  score: number
  mirrorsPlaced: number
  mirrorsAvailable: number
  bestScore: number | null
  hasSubmitted: boolean
  optimalScore: number
  canRestore: boolean
  onRestoreBest: () => void
  onShowOptimal: () => void
  onReset: () => void
  onSubmit: () => void
  onShowResults: () => void
  canSubmit: boolean
}

export function CompactSidebar({
  score,
  mirrorsPlaced,
  mirrorsAvailable,
  bestScore,
  hasSubmitted,
  optimalScore,
  canRestore,
  onRestoreBest,
  onShowOptimal,
  onReset,
  onSubmit,
  onShowResults,
  canSubmit,
}: CompactSidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const didDrag = useRef(false)

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartX.current = e.clientX
    didDrag.current = false
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return
    if (Math.abs(e.clientX - dragStartX.current) > 8) {
      didDrag.current = true
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return
    const dx = e.clientX - dragStartX.current
    if (!didDrag.current) {
      setIsOpen(prev => !prev)
    } else if (dx < -20) {
      setIsOpen(true)
    } else if (dx > 20) {
      setIsOpen(false)
    }
    dragStartX.current = null
    didDrag.current = false
  }

  const showBest = bestScore !== null && bestScore > 0
  const showOptimal = hasSubmitted && optimalScore > 0
  const bestLabel = hasSubmitted ? 'Submitted' : 'Best'

  return (
    // Reserve 48px (w-12) in the layout; panel expands leftward via absolute positioning
    <div className="relative w-12 shrink-0 self-stretch">
      <div
        className="absolute right-0 top-0 bottom-0 bg-gray-800 border-l border-gray-700 overflow-hidden z-10 select-none"
        style={{ width: isOpen ? '10rem' : '3rem', transition: 'width 0.2s ease' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragStartX.current = null }}
      >
        <div className="flex flex-col h-full justify-center py-4">

          {/* Stats group */}
          <StatRow
            label="Path"
            isOpen={isOpen}
            value={
              <span className="text-white font-bold text-2xl font-mono tabular-nums leading-none">
                {score}
              </span>
            }
          />

          <StatRow
            label="Mirrors"
            isOpen={isOpen}
            value={
              <span className="text-white font-bold text-sm font-mono tabular-nums">
                {mirrorsPlaced}<span className="text-gray-500">/{mirrorsAvailable}</span>
              </span>
            }
          />

          {showBest && (
            <StatRow
              label={bestLabel}
              isOpen={isOpen}
              value={
                <span className="text-emerald-400 font-bold text-sm font-mono tabular-nums">
                  {bestScore}
                </span>
              }
              clickable={canRestore}
              onClick={canRestore ? onRestoreBest : undefined}
            />
          )}

          {showOptimal && (
            <StatRow
              label="Optimal"
              isOpen={isOpen}
              value={
                <span className="text-amber-400 font-bold text-sm font-mono tabular-nums">
                  {optimalScore}
                </span>
              }
              clickable
              onClick={onShowOptimal}
            />
          )}

          {/* Gap between stats and buttons */}
          <div className="h-5" />

          {/* Buttons group */}
          <ActionRow
            label="Reset"
            isOpen={isOpen}
            icon={<ResetIcon />}
            onClick={onReset}
          />

          <ActionRow
            label={hasSubmitted ? 'Results' : 'Submit'}
            isOpen={isOpen}
            icon={hasSubmitted ? <ResultsIcon /> : <SubmitIcon />}
            onClick={hasSubmitted ? onShowResults : onSubmit}
            disabled={!hasSubmitted && !canSubmit}
            primary
          />

        </div>
      </div>
    </div>
  )
}

// Each row: label fills the left expansion area; value/icon is always centered
// in the rightmost 48px (w-12), so it's always visible in the collapsed state.
interface StatRowProps {
  label: string
  value: React.ReactNode
  isOpen: boolean
  clickable?: boolean
  onClick?: () => void
}

function StatRow({ label, value, isOpen, clickable, onClick }: StatRowProps) {
  return (
    <div
      className={`flex items-center h-10 ${clickable ? 'cursor-pointer active:bg-gray-700/60' : ''}`}
      onClick={onClick}
      onPointerDown={onClick ? (e => e.stopPropagation()) : undefined}
    >
      {/* min-w-0 lets flex shrink this to 0; padding zeroed when closed so it
          takes no space and the value div is truly centered in the 48px panel */}
      <span
        className="flex-1 min-w-0 text-xs text-gray-400 whitespace-nowrap overflow-hidden transition-opacity duration-150"
        style={{
          opacity: isOpen ? 1 : 0,
          paddingLeft: isOpen ? '0.75rem' : 0,
          paddingRight: isOpen ? '0.25rem' : 0,
        }}
      >
        {label}
      </span>
      <div className="w-12 shrink-0 flex justify-center items-center">
        {value}
      </div>
    </div>
  )
}

interface ActionRowProps {
  label: string
  icon: React.ReactNode
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
  primary?: boolean
}

function ActionRow({ label, icon, isOpen, onClick, disabled, primary }: ActionRowProps) {
  return (
    <button
      className={`w-full flex items-center h-10 transition-colors ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : primary
          ? 'text-emerald-400 active:bg-gray-700/60'
          : 'text-gray-300 active:bg-gray-700/60'
      }`}
      onClick={disabled ? undefined : onClick}
      onPointerDown={e => e.stopPropagation()}
      disabled={disabled}
    >
      <span
        className="flex-1 min-w-0 text-xs text-left whitespace-nowrap overflow-hidden transition-opacity duration-150"
        style={{
          opacity: isOpen ? 1 : 0,
          paddingLeft: isOpen ? '0.75rem' : 0,
          paddingRight: isOpen ? '0.25rem' : 0,
        }}
      >
        {label}
      </span>
      <div className="w-12 shrink-0 flex justify-center items-center">
        {icon}
      </div>
    </button>
  )
}

function ResetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

function SubmitIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function ResultsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
