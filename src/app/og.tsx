import { boardSvg, svgDataUri } from '@/lib/boardSvg'
import type { LevelConfig, Mirror } from '@/game/types'

// Shared layout for link-preview images: a board on the left, text on the right.

export const OG_SIZE = { width: 1200, height: 630 }

interface CardProps {
  level: LevelConfig
  mirrors?: Mirror[]
  kicker: string
  title: string
  lines: string[]
}

export function OgCard({ level, mirrors, kicker, title, lines }: CardProps) {
  const pad = 40
  const boardH = OG_SIZE.height - pad * 2
  const boardW = Math.min(Math.round((boardH * level.gridWidth) / level.gridHeight), 560)
  const boardHFit = Math.round((boardW * level.gridHeight) / level.gridWidth)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 56,
        padding: pad,
        background: '#111827',
        color: '#f9fafb',
        fontFamily: 'sans-serif',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={svgDataUri(boardSvg(level, mirrors))}
        width={boardW}
        height={boardHFit}
        alt=""
        style={{ borderRadius: 12, border: '3px solid #374151' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: '#34d399' }}>{kicker}</div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{title}</div>
        {lines.map((line) => (
          <div key={line} style={{ fontSize: 32, color: '#d1d5db', lineHeight: 1.3 }}>
            {line}
          </div>
        ))}
      </div>
    </div>
  )
}
