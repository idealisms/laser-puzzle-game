import type { LaserPath, Mirror } from './types'

// Reasons a player might not want to submit yet. They only get one submission
// per puzzle, so the game asks before submitting when any of these apply.

export type SubmitWarningId = 'unplaced-mirrors' | 'unused-mirrors' | 'not-best'

export interface SubmitWarning {
  id: SubmitWarningId
  message: string
}

interface SubmitContext {
  placedMirrors: Mirror[]
  mirrorsAvailable: number
  laserPath: LaserPath | null
  score: number
  // Best score reached so far this session, before submitting.
  sessionBestScore: number
}

/** Placed mirrors that no beam ever reaches. */
export function findUnusedMirrors(placedMirrors: Mirror[], laserPath: LaserPath | null): Mirror[] {
  const reached = new Set<string>()
  for (const stream of laserPath?.streams ?? []) {
    for (const segment of stream.segments) reached.add(`${segment.end.x},${segment.end.y}`)
  }
  return placedMirrors.filter((m) => !reached.has(`${m.position.x},${m.position.y}`))
}

function mirrors(n: number): string {
  return n === 1 ? '1 mirror' : `${n} mirrors`
}

export function getSubmitWarnings(ctx: SubmitContext): SubmitWarning[] {
  const warnings: SubmitWarning[] = []

  const unplaced = ctx.mirrorsAvailable - ctx.placedMirrors.length
  if (unplaced > 0) {
    warnings.push({
      id: 'unplaced-mirrors',
      message: `You still have ${mirrors(unplaced)} left to place.`,
    })
  }

  const unused = findUnusedMirrors(ctx.placedMirrors, ctx.laserPath).length
  if (unused > 0) {
    warnings.push({
      id: 'unused-mirrors',
      message:
        unused === 1
          ? '1 of your mirrors isn’t touched by the laser, so it isn’t doing anything.'
          : `${unused} of your mirrors aren’t touched by the laser, so they aren’t doing anything.`,
    })
  }

  if (ctx.sessionBestScore > ctx.score) {
    warnings.push({
      id: 'not-best',
      message: `This path is ${ctx.score} long, but you reached ${ctx.sessionBestScore} earlier. Tap Best to bring that path back.`,
    })
  }

  return warnings
}
