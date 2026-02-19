export const CELL_SIZE = 40
export const DEFAULT_GRID_WIDTH = 15
export const DEFAULT_GRID_HEIGHT = 20
export const MAX_LASER_LENGTH = 1000

export type ColorScheme = typeof DEFAULT_COLORS

const DEFAULT_COLORS = {
  grid: {
    background: '#1a1a2e',
    lines: '#16213e',
    cell: '#0f3460',
  },
  laser: {
    beam: '#ff0000',
    glow: 'rgba(255, 0, 0, 0.3)',
    source: '#ff4444',
    blip: '#ff4444',
  },
  laserStreams: [
    { beam: '#ff0000', glow: 'rgba(255,0,0,0.3)',     blip: '#ff4444' },  // gen 0 (primary)
    { beam: '#00ccff', glow: 'rgba(0,204,255,0.3)',   blip: '#44ddff' },  // gen 1 (cyan)
    { beam: '#ffaa00', glow: 'rgba(255,170,0,0.3)',   blip: '#ffbb44' },  // gen 2 (orange)
    { beam: '#44ff44', glow: 'rgba(68,255,68,0.3)',   blip: '#66ff66' },  // gen 3+ (green)
  ],
  mirror: {
    frame: '#c0c0c0',
    surface: '#e8e8e8',
    highlight: '#ffffff',
  },
  obstacle: {
    fill: '#4a4a5a',
    stroke: '#3a3a4a',
  },
  splitter: {
    fill: '#0a1525',
    stroke: '#1a4060',
    cross: '#00ccff',
  },
  eraser: {
    highlight: 'rgba(255, 0, 0, 0.25)',
    border: 'rgba(255, 0, 0, 0.6)',
  },
  ui: {
    selected: '#4ecca3',
    hover: 'rgba(78, 204, 163, 0.3)',
    disabled: '#666666',
  },
}

const COLORBLIND_COLORS: ColorScheme = {
  ...DEFAULT_COLORS,
  laser: {
    beam: '#4488ff',
    glow: 'rgba(68, 136, 255, 0.3)',
    source: '#66aaff',
    blip: '#66aaff',
  },
  laserStreams: [
    { beam: '#4488ff', glow: 'rgba(68,136,255,0.3)',  blip: '#66aaff' },  // gen 0 (blue)
    { beam: '#ff9933', glow: 'rgba(255,153,51,0.3)',  blip: '#ffaa55' },  // gen 1 (orange)
    { beam: '#44bb44', glow: 'rgba(68,187,68,0.3)',   blip: '#66cc66' },  // gen 2 (green)
    { beam: '#aa44ff', glow: 'rgba(170,68,255,0.3)',  blip: '#bb66ff' },  // gen 3+ (purple)
  ],
  splitter: {
    fill: '#0a1525',
    stroke: '#1a4060',
    cross: '#4488ff',
  },
  eraser: {
    highlight: 'rgba(255, 153, 0, 0.25)',
    border: 'rgba(255, 153, 0, 0.6)',
  },
  ui: {
    selected: '#ff9933',
    hover: 'rgba(255, 153, 51, 0.3)',
    disabled: '#666666',
  },
}

export const COLORS = DEFAULT_COLORS

export function getColors(colorblindMode: boolean): ColorScheme {
  return colorblindMode ? COLORBLIND_COLORS : DEFAULT_COLORS
}

export const LASER_BLIP = {
  spacing: 15,   // distance between blips in cells
  speed: 15,     // cells per second
  radius: 4,    // blip circle radius in pixels
}

// Pixels to offset laser beams perpendicular to their travel direction.
// Keeps opposing beams (e.g. left vs right) visually separated.
export const LASER_LANE_OFFSET = 3

