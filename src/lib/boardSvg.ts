import { calculateLaserPath } from '@/game/engine/simulate'
import { COLORS } from '@/game/constants'
import type { Direction, LevelConfig, Mirror, Obstacle } from '@/game/types'

// Draws a board as an SVG string, for link-preview images (which can't use the
// game's canvas renderer). Shapes and colors follow src/game/engine/Renderer.ts.

const C = 40 // cell size in SVG units; the image scales it

function cellCenter(x: number, y: number): [number, number] {
  return [x * C + C / 2, y * C + C / 2]
}

function wall(o: Obstacle): string {
  const p = 4
  return `<rect x="${o.x * C + p}" y="${o.y * C + p}" width="${C - 2 * p}" height="${C - 2 * p}" fill="${COLORS.obstacle.fill}" stroke="${COLORS.obstacle.stroke}" stroke-width="2"/>`
}

function splitter(o: Obstacle): string {
  const p = 4
  const ox = o.x * C
  const oy = o.y * C
  const [cx, cy] = cellCenter(o.x, o.y)
  // The wall face's two corners; the right-angle point is the cell centre.
  const corners: Record<Direction, [number, number, number, number]> = {
    right: [ox + C - p, oy + p, ox + C - p, oy + C - p],
    left: [ox + p, oy + p, ox + p, oy + C - p],
    up: [ox + p, oy + p, ox + C - p, oy + p],
    down: [ox + p, oy + C - p, ox + C - p, oy + C - p],
  }
  const [x1, y1, x2, y2] = corners[o.orientation ?? 'right']
  const s = COLORS.splitter
  return (
    `<polygon points="${cx},${cy} ${x1},${y1} ${x2},${y2}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.5"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s.cross}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="${cx}" cy="${cy}" r="3" fill="${s.cross}"/>`
  )
}

function gate(o: Obstacle): string {
  const p = 4
  const [cx, cy] = cellCenter(o.x, o.y)
  const r = C / 2 - p
  const [dx, dy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[o.orientation ?? 'right']
  const [px, py] = [-dy, dx]
  const tail = [cx - dx * r * 0.55, cy - dy * r * 0.55]
  const tip = [cx + dx * r * 0.75, cy + dy * r * 0.75]
  const junc = [cx + dx * r * 0.2, cy + dy * r * 0.2]
  const w = r * 0.42
  const g = COLORS.gate
  return (
    `<rect x="${o.x * C + p}" y="${o.y * C + p}" width="${C - 2 * p}" height="${C - 2 * p}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="2"/>` +
    `<line x1="${tail[0]}" y1="${tail[1]}" x2="${junc[0]}" y2="${junc[1]}" stroke="${g.arrow}" stroke-width="2.5" stroke-linecap="round"/>` +
    `<polygon points="${tip[0]},${tip[1]} ${junc[0] + px * w},${junc[1] + py * w} ${junc[0] - px * w},${junc[1] - py * w}" fill="${g.arrow}"/>`
  )
}

function portalShape(pair: number, cx: number, cy: number, r: number, attrs: string): string {
  if (pair === 2) {
    const h = r * 0.85
    return `<rect x="${cx - h}" y="${cy - h}" width="${h * 2}" height="${h * 2}" ${attrs}/>`
  }
  if (pair === 3) {
    const pts = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3
      return `${cx + Math.cos(a) * r * 1.1},${cy + Math.sin(a) * r * 1.1 + r * 0.12}`
    })
    return `<polygon points="${pts.join(' ')}" ${attrs}/>`
  }
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${attrs}/>`
}

function portal(o: Obstacle): string {
  const pair = Math.min(Math.max(o.pair ?? 1, 1), COLORS.portal.length)
  const colors = COLORS.portal[pair - 1]
  const [cx, cy] = cellCenter(o.x, o.y)
  const r = C / 2 - 5
  return (
    portalShape(pair, cx, cy, r, `fill="${colors.glow}" stroke="${colors.ring}" stroke-width="3" stroke-linejoin="round"`) +
    portalShape(pair, cx, cy, r * 0.5, `fill="none" stroke="${colors.ring}" stroke-width="1.5" stroke-linejoin="round"`)
  )
}

function laserSource(x: number, y: number, dir: Direction): string {
  const [cx, cy] = cellCenter(x, y)
  const s = C * 0.3
  const pts: Record<Direction, number[][]> = {
    right: [[cx - s, cy - s], [cx + s, cy], [cx - s, cy + s]],
    left: [[cx + s, cy - s], [cx - s, cy], [cx + s, cy + s]],
    down: [[cx - s, cy - s], [cx, cy + s], [cx + s, cy - s]],
    up: [[cx - s, cy + s], [cx, cy - s], [cx + s, cy + s]],
  }
  return `<polygon points="${pts[dir].map((p) => p.join(',')).join(' ')}" fill="${COLORS.laser.source}"/>`
}

function mirror(m: Mirror): string {
  const [cx, cy] = cellCenter(m.position.x, m.position.y)
  const h = C * 0.35
  const [x1, y1, x2, y2] = m.type === '/' ? [cx + h, cy - h, cx - h, cy + h] : [cx - h, cy - h, cx + h, cy + h]
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLORS.mirror.surface}" stroke-width="4" stroke-linecap="round"/>`
}

/**
 * The board as the player first sees it (or with `mirrors` placed): walls,
 * splitters, gates, portals, the laser and its beam. Never includes a solution
 * unless one is passed in.
 */
export function boardSvg(level: LevelConfig, mirrors: Mirror[] = []): string {
  const w = level.gridWidth * C
  const h = level.gridHeight * C
  const parts: string[] = [`<rect width="${w}" height="${h}" fill="${COLORS.grid.background}"/>`]

  for (let x = 0; x <= level.gridWidth; x++) {
    parts.push(`<line x1="${x * C}" y1="0" x2="${x * C}" y2="${h}" stroke="${COLORS.grid.lines}" stroke-width="1"/>`)
  }
  for (let y = 0; y <= level.gridHeight; y++) {
    parts.push(`<line x1="0" y1="${y * C}" x2="${w}" y2="${y * C}" stroke="${COLORS.grid.lines}" stroke-width="1"/>`)
  }

  for (const o of level.obstacles) {
    if (o.type === 'splitter') parts.push(splitter(o))
    else if (o.type === 'gate') parts.push(gate(o))
    else if (o.type === 'portal') parts.push(portal(o))
    else parts.push(wall(o))
  }

  const { laserConfig } = level
  parts.push(laserSource(laserConfig.x, laserConfig.y, laserConfig.direction))

  const path = calculateLaserPath(laserConfig, mirrors, level.obstacles, { width: level.gridWidth, height: level.gridHeight })
  for (const pass of ['glow', 'beam'] as const) {
    for (const stream of path.streams) {
      if (stream.segments.length === 0) continue
      const colors = COLORS.laserStreams[Math.min(stream.colorIndex ?? 0, COLORS.laserStreams.length - 1)]
      let d = ''
      let prev: { x: number; y: number } | null = null
      for (const seg of stream.segments) {
        // A portal jump starts somewhere other than where the last segment ended.
        if (!prev || seg.start.x !== prev.x || seg.start.y !== prev.y) d += `M${cellCenter(seg.start.x, seg.start.y).join(' ')} `
        d += `L${cellCenter(seg.end.x, seg.end.y).join(' ')} `
        prev = seg.end
      }
      const stroke = pass === 'glow' ? `stroke="${colors.glow}" stroke-width="8"` : `stroke="${colors.beam}" stroke-width="3"`
      parts.push(`<path d="${d.trim()}" fill="none" ${stroke} stroke-linecap="round" stroke-linejoin="round"/>`)
    }
  }

  for (const m of mirrors) parts.push(mirror(m))

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${parts.join('')}</svg>`
}

export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}
