import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/ui/Header'
import { ExampleBoard } from './ExampleBoard'
import { EXAMPLES } from './examples'

export const metadata: Metadata = {
  title: { absolute: 'How to Play Laser Puzzle: Mirrors, Splitters, Gates and Portals' },
  description:
    'Rules and strategy for Laser Puzzle, the free daily logic game: how mirrors, walls, splitters, one-way gates and portals bend the laser, and tips for a longer path.',
  alternates: { canonical: '/how-to-play' },
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-4">
      <h2 className="text-2xl font-bold text-white">{title}</h2>
      {children}
    </section>
  )
}

function Examples({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 items-start">{children}</div>
}

export default function HowToPlayPage() {
  return (
    <div className="min-h-svh flex flex-col">
      <Header />
      <main className="w-full max-w-2xl mx-auto px-4 py-8 space-y-12 text-gray-300 leading-relaxed">
        <div className="space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-white">How to play Laser Puzzle</h1>
          <p>
            Laser Puzzle is a free daily logic puzzle. A laser fires across a grid, and you place mirrors to bend
            it into the <strong className="text-white">longest path you can</strong>. There&apos;s a new puzzle
            every day, and everyone gets the same one.
          </p>
          <nav aria-label="On this page" className="text-sm">
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-emerald-400">
              <li><a href="#goal" className="hover:text-emerald-300">Goal</a></li>
              <li><a href="#mirrors" className="hover:text-emerald-300">Mirrors</a></li>
              <li><a href="#walls" className="hover:text-emerald-300">Walls</a></li>
              <li><a href="#splitters" className="hover:text-emerald-300">Splitters</a></li>
              <li><a href="#gates" className="hover:text-emerald-300">Gates</a></li>
              <li><a href="#portals" className="hover:text-emerald-300">Portals</a></li>
              <li><a href="#collisions" className="hover:text-emerald-300">Collisions</a></li>
              <li><a href="#strategy" className="hover:text-emerald-300">Strategy</a></li>
            </ul>
          </nav>
        </div>

        <Section id="goal" title="The goal">
          <p>
            Your score is the <strong className="text-white">path length</strong>: how many steps the laser takes
            before it leaves the board or is stopped. When the beam splits, every beam counts.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Each puzzle gives you a limited number of mirrors, usually 8 to 11.</li>
            <li>Click or tap an empty square to place a mirror. Click it again to flip it, and once more to remove it.</li>
            <li>Hold and drag to erase several mirrors at once.</li>
            <li>
              Experiment as much as you like, but you only get <strong className="text-white">one submission</strong>{' '}
              per puzzle. Afterwards you&apos;ll see how your path compares with the best possible one and with other
              players.
            </li>
            <li>Your best attempt so far is saved. Tap it to put those mirrors back on the board.</li>
          </ul>
        </Section>

        <Section id="mirrors" title="Mirrors">
          <p>
            A mirror turns the beam 90 degrees. There are two kinds, <code className="text-white">/</code> and{' '}
            <code className="text-white">\</code>, and both sides of a mirror reflect, so a beam can come back
            and bounce off the other side later.
          </p>
          <Examples>
            <ExampleBoard example={EXAMPLES.mirrors} />
          </Examples>
        </Section>

        <Section id="walls" title="Walls">
          <p>
            Grey squares are walls. A beam that hits one stops there, and you can&apos;t place mirrors on them.
            Most of a puzzle is working out how to wind the beam through the gaps.
          </p>
          <Examples>
            <ExampleBoard example={EXAMPLES.walls} />
          </Examples>
        </Section>

        <Section id="splitters" title="Splitters">
          <p>
            A splitter is a triangle. What it does depends on which side the beam hits:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong className="text-white">The point:</strong> the beam splits into two beams that leave at right
              angles, one each way. Both new beams add to your score, and each gets its own color.
            </li>
            <li>
              <strong className="text-white">A side:</strong> the beam turns and leaves through the point.
            </li>
            <li>
              <strong className="text-white">The flat back:</strong> the beam stops, as if it hit a wall.
            </li>
          </ul>
          <Examples>
            <ExampleBoard example={EXAMPLES.splitterSplit} />
            <ExampleBoard example={EXAMPLES.splitterTurn} />
          </Examples>
        </Section>

        <Section id="gates" title="One-way gates">
          <p>
            A gate has an arrow. A beam travelling the way the arrow points passes straight through, and the gate
            counts as a step. From any other direction, the gate is a wall.
          </p>
          <Examples>
            <ExampleBoard example={EXAMPLES.gatePass} />
            <ExampleBoard example={EXAMPLES.gateBlock} />
          </Examples>
        </Section>

        <Section id="portals" title="Portals">
          <p>
            Portals come in matching pairs, shown by color and shape. A beam that enters one portal comes out of
            its twin, still heading the same way. Entering costs one step, and the jump itself is free. Portals
            work from any side and in both directions, and a beam can use the same portal more than once.
          </p>
          <p>Portals are often the only way into a part of the board that walls seal off.</p>
          <Examples>
            <ExampleBoard example={EXAMPLES.portals} />
          </Examples>
        </Section>

        <Section id="collisions" title="Collisions">
          <p>
            Beams can cross each other at right angles. But when two beams meet head-on they both stop with a
            spark, and a beam that runs head-on into a path that&apos;s already lit stops there. The same goes for
            two beams hitting the same face of a mirror. With splitters on the board, watch out for beams that cut
            each other short.
          </p>
          <Examples>
            <ExampleBoard example={EXAMPLES.collision} />
          </Examples>
        </Section>

        <Section id="strategy" title="Strategy tips">
          <ul className="list-disc pl-6 space-y-3">
            <li>
              <strong className="text-white">Find the longest runs first.</strong> Before placing anything, look
              for the longest straight lines on the board, such as rows or columns with no walls in the way. Then
              work out how to get the beam into each one and out again.
            </li>
            <li>
              <strong className="text-white">Make every mirror earn its place.</strong> Long straight runs score the
              most per mirror, so zigzag across the whole width or height of the board instead of making tight
              turns.
            </li>
            <li>
              <strong className="text-white">Use the edges and corners.</strong> Walls that reach the edge split
              the board into regions. Plan how the beam will get into each one and back out.
            </li>
            <li>
              <strong className="text-white">Work backwards.</strong> Pick where you want the beam to finish, often
              a far corner, and trace a route back to the laser.
            </li>
            <li>
              <strong className="text-white">Give both split beams somewhere to go.</strong>{' '}
              After a splitter, each
              beam needs its own long route. Make sure they won&apos;t run into each other head-on.
            </li>
            <li>
              <strong className="text-white">Check where gates and portals lead.</strong> A gate can block a
              shortcut you were counting on, and a portal is only worth using if the beam has room to run when it
              comes out.
            </li>
            <li>
              <strong className="text-white">Save your submission.</strong> Your best attempt is kept, so try wild
              ideas before you submit.
            </li>
          </ul>
        </Section>

        <div className="flex flex-wrap gap-4 pt-2">
          <Link
            href="/"
            className="px-5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
          >
            Play today&apos;s puzzle
          </Link>
          <Link
            href="/game"
            className="px-5 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
          >
            Browse past puzzles
          </Link>
        </div>
      </main>
    </div>
  )
}
