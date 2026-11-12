import { buildShareText } from './shareText'

const base = {
  date: '2026-11-11',
  percentage: 90,
  achievements: [
    { id: 'perfect-score', emoji: '💯', label: 'Perfect Score' },
    { id: 'streak', emoji: '🔥', label: 'Streak' },
  ],
  siteUrl: 'https://laserpuzzle.ponderer.org',
  includeLink: true,
}

describe('buildShareText', () => {
  it('links to that day’s puzzle with a full URL', () => {
    expect(buildShareText(base)).toBe(
      'Laser Puzzle 2026/11/11\n90% 💯🔥\nhttps://laserpuzzle.ponderer.org/game/2026-11-11'
    )
  })

  it('leaves the link out when asked', () => {
    expect(buildShareText({ ...base, includeLink: false })).toBe('Laser Puzzle 2026/11/11\n90% 💯🔥')
  })

  it('works without achievements', () => {
    expect(buildShareText({ ...base, achievements: [], includeLink: false })).toBe('Laser Puzzle 2026/11/11\n90%')
  })
})
