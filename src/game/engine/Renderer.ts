import { GameState, Position, Direction, LaserSegment } from '../types'
import { CELL_SIZE, COLORS, LASER_BLIP } from '../constants'

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private width: number
  private height: number

  constructor(ctx: CanvasRenderingContext2D, width: number, height: number) {
    this.ctx = ctx
    this.width = width
    this.height = height
  }

  clear(): void {
    this.ctx.fillStyle = COLORS.grid.background
    this.ctx.fillRect(0, 0, this.width, this.height)
  }

  drawGrid(gridWidth: number, gridHeight: number): void {
    this.ctx.strokeStyle = COLORS.grid.lines
    this.ctx.lineWidth = 1

    // Draw vertical lines
    for (let x = 0; x <= gridWidth; x++) {
      this.ctx.beginPath()
      this.ctx.moveTo(x * CELL_SIZE, 0)
      this.ctx.lineTo(x * CELL_SIZE, gridHeight * CELL_SIZE)
      this.ctx.stroke()
    }

    // Draw horizontal lines
    for (let y = 0; y <= gridHeight; y++) {
      this.ctx.beginPath()
      this.ctx.moveTo(0, y * CELL_SIZE)
      this.ctx.lineTo(gridWidth * CELL_SIZE, y * CELL_SIZE)
      this.ctx.stroke()
    }
  }

  drawLaserSource(x: number, y: number, direction: Direction): void {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2
    const centerY = y * CELL_SIZE + CELL_SIZE / 2
    const size = CELL_SIZE * 0.3

    this.ctx.fillStyle = COLORS.laser.source
    this.ctx.beginPath()

    // Draw triangle pointing in the direction
    switch (direction) {
      case 'right':
        this.ctx.moveTo(centerX - size, centerY - size)
        this.ctx.lineTo(centerX + size, centerY)
        this.ctx.lineTo(centerX - size, centerY + size)
        break
      case 'left':
        this.ctx.moveTo(centerX + size, centerY - size)
        this.ctx.lineTo(centerX - size, centerY)
        this.ctx.lineTo(centerX + size, centerY + size)
        break
      case 'down':
        this.ctx.moveTo(centerX - size, centerY - size)
        this.ctx.lineTo(centerX, centerY + size)
        this.ctx.lineTo(centerX + size, centerY - size)
        break
      case 'up':
        this.ctx.moveTo(centerX - size, centerY + size)
        this.ctx.lineTo(centerX, centerY - size)
        this.ctx.lineTo(centerX + size, centerY + size)
        break
    }

    this.ctx.closePath()
    this.ctx.fill()
  }

  drawObstacle(x: number, y: number): void {
    const padding = 4
    this.ctx.fillStyle = COLORS.obstacle.fill
    this.ctx.strokeStyle = COLORS.obstacle.stroke
    this.ctx.lineWidth = 2

    this.ctx.fillRect(
      x * CELL_SIZE + padding,
      y * CELL_SIZE + padding,
      CELL_SIZE - padding * 2,
      CELL_SIZE - padding * 2
    )
    this.ctx.strokeRect(
      x * CELL_SIZE + padding,
      y * CELL_SIZE + padding,
      CELL_SIZE - padding * 2,
      CELL_SIZE - padding * 2
    )
  }

  drawMirror(x: number, y: number, type: '/' | '\\'): void {
    const centerX = x * CELL_SIZE + CELL_SIZE / 2
    const centerY = y * CELL_SIZE + CELL_SIZE / 2
    const halfSize = CELL_SIZE * 0.35

    this.ctx.strokeStyle = COLORS.mirror.surface
    this.ctx.lineWidth = 4
    this.ctx.lineCap = 'round'

    this.ctx.beginPath()
    if (type === '/') {
      // NE-SW diagonal
      this.ctx.moveTo(centerX + halfSize, centerY - halfSize)
      this.ctx.lineTo(centerX - halfSize, centerY + halfSize)
    } else {
      // NW-SE diagonal
      this.ctx.moveTo(centerX - halfSize, centerY - halfSize)
      this.ctx.lineTo(centerX + halfSize, centerY + halfSize)
    }
    this.ctx.stroke()

    // Draw highlight
    this.ctx.strokeStyle = COLORS.mirror.highlight
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    if (type === '/') {
      this.ctx.moveTo(centerX + halfSize - 2, centerY - halfSize + 2)
      this.ctx.lineTo(centerX - halfSize + 2, centerY + halfSize - 2)
    } else {
      this.ctx.moveTo(centerX - halfSize + 2, centerY - halfSize + 2)
      this.ctx.lineTo(centerX + halfSize - 2, centerY + halfSize - 2)
    }
    this.ctx.stroke()
  }

  drawLaserPath(segments: LaserSegment[]): void {
    if (segments.length === 0) return

    // Draw glow
    this.ctx.strokeStyle = COLORS.laser.glow
    this.ctx.lineWidth = 8
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    const firstSeg = segments[0]
    this.ctx.moveTo(
      firstSeg.start.x * CELL_SIZE + CELL_SIZE / 2,
      firstSeg.start.y * CELL_SIZE + CELL_SIZE / 2
    )

    for (const seg of segments) {
      this.ctx.lineTo(
        seg.end.x * CELL_SIZE + CELL_SIZE / 2,
        seg.end.y * CELL_SIZE + CELL_SIZE / 2
      )
    }
    this.ctx.stroke()

    // Draw main beam
    this.ctx.strokeStyle = COLORS.laser.beam
    this.ctx.lineWidth = 3

    this.ctx.beginPath()
    this.ctx.moveTo(
      firstSeg.start.x * CELL_SIZE + CELL_SIZE / 2,
      firstSeg.start.y * CELL_SIZE + CELL_SIZE / 2
    )

    for (const seg of segments) {
      this.ctx.lineTo(
        seg.end.x * CELL_SIZE + CELL_SIZE / 2,
        seg.end.y * CELL_SIZE + CELL_SIZE / 2
      )
    }
    this.ctx.stroke()
  }

  drawLaserBlips(segments: LaserSegment[], time: number): void {
    if (segments.length === 0) return

    // Build cumulative lengths along the path (in pixels)
    const segLengths: number[] = []
    let totalLength = 0
    for (const seg of segments) {
      const dx = (seg.end.x - seg.start.x) * CELL_SIZE
      const dy = (seg.end.y - seg.start.y) * CELL_SIZE
      const len = Math.sqrt(dx * dx + dy * dy)
      segLengths.push(len)
      totalLength += len
    }

    if (totalLength === 0) return

    const spacingPx = LASER_BLIP.spacing * CELL_SIZE
    const offsetPx = (time * LASER_BLIP.speed * CELL_SIZE) % spacingPx

    this.ctx.save()
    this.ctx.fillStyle = COLORS.laser.blip
    this.ctx.shadowColor = COLORS.laser.blip
    this.ctx.shadowBlur = 8

    for (let d = offsetPx; d <= totalLength; d += spacingPx) {
      // Find which segment this distance falls in
      let remaining = d
      let px = 0
      let py = 0
      let found = false

      for (let i = 0; i < segments.length; i++) {
        if (remaining <= segLengths[i]) {
          const t = segLengths[i] > 0 ? remaining / segLengths[i] : 0
          const seg = segments[i]
          px = (seg.start.x + (seg.end.x - seg.start.x) * t) * CELL_SIZE + CELL_SIZE / 2
          py = (seg.start.y + (seg.end.y - seg.start.y) * t) * CELL_SIZE + CELL_SIZE / 2
          found = true
          break
        }
        remaining -= segLengths[i]
      }

      if (!found) continue

      this.ctx.beginPath()
      this.ctx.arc(px, py, LASER_BLIP.radius, 0, Math.PI * 2)
      this.ctx.fill()
    }

    this.ctx.restore()
  }

  drawEraserHighlight(x: number, y: number): void {
    this.ctx.fillStyle = COLORS.eraser.highlight
    this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)

    this.ctx.strokeStyle = COLORS.eraser.border
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(
      x * CELL_SIZE + 2,
      y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4
    )
  }

  drawHoverPreview(x: number, y: number, type: '/' | '\\', canPlace: boolean): void {
    if (!canPlace) {
      // Draw red X
      this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)'
      this.ctx.lineWidth = 3
      const padding = 15
      this.ctx.beginPath()
      this.ctx.moveTo(x * CELL_SIZE + padding, y * CELL_SIZE + padding)
      this.ctx.lineTo((x + 1) * CELL_SIZE - padding, (y + 1) * CELL_SIZE - padding)
      this.ctx.moveTo((x + 1) * CELL_SIZE - padding, y * CELL_SIZE + padding)
      this.ctx.lineTo(x * CELL_SIZE + padding, (y + 1) * CELL_SIZE - padding)
      this.ctx.stroke()
      return
    }

    // Draw translucent mirror preview
    this.ctx.globalAlpha = 0.5
    this.drawMirror(x, y, type)
    this.ctx.globalAlpha = 1.0

    // Draw hover highlight
    this.ctx.strokeStyle = COLORS.ui.hover
    this.ctx.lineWidth = 2
    this.ctx.strokeRect(
      x * CELL_SIZE + 2,
      y * CELL_SIZE + 2,
      CELL_SIZE - 4,
      CELL_SIZE - 4
    )
  }

  render(state: GameState, hoverPos: Position | null, isEraserMode?: boolean, time?: number): void {
    this.clear()

    const { level, placedMirrors, laserPath } = state

    // Draw grid
    this.drawGrid(level.gridWidth, level.gridHeight)

    // Draw obstacles
    for (const obstacle of level.obstacles) {
      this.drawObstacle(obstacle.x, obstacle.y)
    }

    // Draw laser source
    this.drawLaserSource(
      level.laserConfig.x,
      level.laserConfig.y,
      level.laserConfig.direction
    )

    // Draw laser path
    if (laserPath) {
      this.drawLaserPath(laserPath.segments)
      if (time != null) {
        this.drawLaserBlips(laserPath.segments, time)
      }
    }

    // Draw placed mirrors
    for (const mirror of placedMirrors) {
      this.drawMirror(mirror.position.x, mirror.position.y, mirror.type)
    }

    // Draw hover preview
    if (hoverPos) {
      const existingMirror = placedMirrors.find(
        (m) => m.position.x === hoverPos.x && m.position.y === hoverPos.y
      )

      if (isEraserMode && existingMirror) {
        this.drawEraserHighlight(hoverPos.x, hoverPos.y)
      } else if (!existingMirror) {
        const canPlace =
          hoverPos.x >= 0 &&
          hoverPos.x < level.gridWidth &&
          hoverPos.y >= 0 &&
          hoverPos.y < level.gridHeight &&
          !(
            hoverPos.x === level.laserConfig.x &&
            hoverPos.y === level.laserConfig.y
          ) &&
          !level.obstacles.some(
            (o) => o.x === hoverPos.x && o.y === hoverPos.y
          ) &&
          placedMirrors.length < level.mirrorsAvailable

        this.drawHoverPreview(hoverPos.x, hoverPos.y, state.selectedMirrorType, canPlace)
      }
    }
  }
}
