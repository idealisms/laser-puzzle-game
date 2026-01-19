'use client'

import { Button } from '@/components/ui/Button'

interface GameControlsProps {
  onReset: () => void
  onSubmit: () => void
  canSubmit: boolean
}

export function GameControls({ onReset, onSubmit, canSubmit }: GameControlsProps) {
  return (
    <div className="flex gap-3">
      <Button variant="secondary" onClick={onReset}>
        Reset
      </Button>
      <Button variant="primary" onClick={onSubmit} disabled={!canSubmit}>
        Submit Score
      </Button>
    </div>
  )
}
