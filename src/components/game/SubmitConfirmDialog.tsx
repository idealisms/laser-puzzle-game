'use client'

import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { SubmitWarning } from '@/game/submitWarnings'

interface SubmitConfirmDialogProps {
  warnings: SubmitWarning[] | null
  onSubmitAnyway: () => void
  onCancel: () => void
}

// Asks before submitting a path that looks unfinished. Escape, the backdrop and
// "Don't Submit" all go back to the puzzle.
export function SubmitConfirmDialog({ warnings, onSubmitAnyway, onCancel }: SubmitConfirmDialogProps) {
  return (
    <Modal isOpen={warnings !== null && warnings.length > 0} onClose={onCancel}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="submit-confirm-title" aria-describedby="submit-confirm-body">
        <h2 id="submit-confirm-title" className="text-2xl font-bold text-white mb-3">
          Are you sure?
        </h2>
        <div id="submit-confirm-body" className="text-gray-300 space-y-3">
          <ul className="space-y-2">
            {warnings?.map((w) => (
              <li key={w.id} data-warning={w.id} className="flex">
                <span className="text-amber-400 mr-3" aria-hidden="true">•</span>
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
          <p className="text-gray-400 text-sm">You only get one submission per puzzle.</p>
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          {/* Focused first so Enter doesn't submit by accident. */}
          <Button variant="secondary" onClick={onCancel} autoFocus>
            Don&apos;t Submit
          </Button>
          <Button variant="primary" onClick={onSubmitAnyway}>
            Submit Anyway
          </Button>
        </div>
      </div>
    </Modal>
  )
}
