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
  mirror: {
    frame: '#c0c0c0',
    surface: '#e8e8e8',
    highlight: '#ffffff',
  },
  obstacle: {
    fill: '#4a4a5a',
    stroke: '#3a3a4a',
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

