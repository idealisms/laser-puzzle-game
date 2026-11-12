import Link from 'next/link'

// Plain text below the game, rendered on the server, so search engines (and
// players who scroll) can read what the site is.
export function SiteIntro() {
  return (
    <section className="border-t border-gray-800 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-4 text-gray-400 leading-relaxed">
        <h1 className="text-2xl font-bold text-gray-200">Laser Puzzle: a daily mirror puzzle</h1>
        <p>
          Place mirrors on the grid to bend a laser into the longest path you can. There&apos;s a new puzzle every
          day, the same for everyone, with walls to steer around and, on some days, beam splitters, one-way gates
          and portals.
        </p>
        <p>
          You get one submission per puzzle. Afterwards you can see how your path compares with the best possible
          one and with other players. It&apos;s free, needs no account, and works on phones and computers.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-emerald-400">
          <li>
            <Link href="/how-to-play" className="hover:text-emerald-300">How to play and strategy tips</Link>
          </li>
          <li>
            <Link href="/game" className="hover:text-emerald-300">Past puzzles</Link>
          </li>
        </ul>
      </div>
    </section>
  )
}
