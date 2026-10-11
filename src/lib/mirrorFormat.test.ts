import { parseMirrorList, formatMirrorList } from './mirrorFormat'

describe('parseMirrorList', () => {
  it('parses compact [[x, y, type]] format', () => {
    const result = parseMirrorList([[3, 7, '/'], [5, 2, '\\']] as Parameters<typeof parseMirrorList>[0])
    expect(result).toEqual([
      { x: 3, y: 7, type: '/' },
      { x: 5, y: 2, type: '\\' },
    ])
  })

  it('parses legacy verbose [{x, y, type}] format', () => {
    const result = parseMirrorList([
      { x: 3, y: 7, type: '/' },
      { x: 5, y: 2, type: '\\' },
    ])
    expect(result).toEqual([
      { x: 3, y: 7, type: '/' },
      { x: 5, y: 2, type: '\\' },
    ])
  })

  it('handles empty array', () => {
    expect(parseMirrorList([])).toEqual([])
  })
})

describe('formatMirrorList', () => {
  it('serializes to compact [[x, y, type]] format', () => {
    const result = formatMirrorList([
      { x: 3, y: 7, type: '/' },
      { x: 5, y: 2, type: '\\' },
    ])
    expect(result).toBe('[[3,7,"/"],[5,2,"\\\\"]]')
  })

  it('round-trips through parseMirrorList', () => {
    const mirrors = [{ x: 3, y: 7, type: '/' }, { x: 5, y: 2, type: '\\' }]
    const parsed = parseMirrorList(JSON.parse(formatMirrorList(mirrors)))
    expect(parsed).toEqual(mirrors)
  })

  it('serializes empty array', () => {
    expect(formatMirrorList([])).toBe('[]')
  })
})
