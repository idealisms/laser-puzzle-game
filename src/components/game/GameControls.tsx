'use client'

import { Button } from '@/components/ui/Button'

interface GameControlsProps {
  onReset: () => void
  onSubmit: () => void
  canSubmit: boolean
  hasSubmitted: boolean
  onShowResults: () => void
}

export function GameControls({
  onReset,
  onSubmit,
  canSubmit,
  hasSubmitted,
  onShowResults,
}: GameControlsProps) {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={onReset}>
        Reset
      </Button>
      {hasSubmitted ? (
        <Button variant="primary" onClick={onShowResults}>
          Show Results
        </Button>
      ) : (
        <Button variant="primary" onClick={onSubmit} disabled={!canSubmit}>
          Submit Score
        </Button>
      )}
    </div>
  )
}
