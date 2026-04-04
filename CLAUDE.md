# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A daily laser puzzle game built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, and Prisma with SQLite. Players place mirrors on a grid to redirect a laser beam, aiming for the longest path possible.

## Commands

```bash
npm run dev        # Start development server (port 3000)
npm run build      # Create production build
npm run lint       # Run ESLint
npm run db:seed    # Seed database with 7 days of puzzle levels
npm run db:reset   # Reset database and run migrations
npm test           # Run tests with Jest
```

## Architecture

### Directory Structure

- `/src/app` - Next.js App Router pages and API routes
  - `/api` - REST endpoints (auth, levels, progress, stats)
  - `/(auth)` - Login/register pages (route group)
  - `/game/[date]` - Dynamic game page per daily puzzle
- `/src/components` - React components (`/ui` for reusable, `/game` for game-specific)
- `/src/game/engine` - Pure functional game logic (GameState, Laser, Mirror, Renderer)
- `/src/game/types.ts` - TypeScript interfaces for game entities
- `/src/hooks` - Custom hooks (useGame for state, useCanvas for rendering)
- `/src/context/AuthContext.tsx` - Authentication state via React Context
- `/src/lib` - Utilities (auth.ts for JWT, prisma.ts for DB client)
- `/prisma` - Database schema and seed script

### Key Patterns

**Game State**: Pure functional mutations in `/game/engine/GameState.ts`. Each action returns a new immutable state object.

**Canvas Rendering**: 2D canvas-based rendering via `useCanvas` hook and `Renderer.ts`. Mouse events handled at canvas level.

**Authentication**: JWT stored in HTTP-only cookies. Use `useAuth()` hook client-side, `getCurrentUser()` server-side.

**API Routes**: RESTful JSON endpoints. Errors return `{ error: string }` with appropriate HTTP status codes.

**Components**: Client components use `"use client"` directive. Tailwind classes for styling, no CSS modules.

### Database Models

```
User → UserStats (1:1)
User → LevelProgress (1:many)
Level → LevelProgress (1:many)
```

Complex fields (laserConfig, obstacles, solution) stored as JSON.

## Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)

## Workflow

Always commit changes to git after completing each edit or logical unit of work. Do not batch multiple unrelated changes into a single commit.

When working with the database, never echo the production database name or password. Use stars to keep the information secret.

## Generating Puzzle Levels

### Pipeline
1. Create `solver/puzzles/YYYY-MM-DD.json` — the puzzle config (obstacle layout, laser, mirrors, splitters)
2. Run solver from inside the `solver/` directory:
   - No splitters: `cd solver && npx tsx generate_levels.ts --start DATE --end DATE --workers 12 --v2 --beam-width 12000`
   - Splitters: `cd solver && npx tsx generate_levels.ts --start DATE --end DATE --workers 12 --beam-width 6000` (expect ~9 min per puzzle)
3. Seed to dev: `DOTENV_CONFIG_PATH=.env.local npm run db:seed`
4. Seed to prod: `DOTENV_CONFIG_PATH=.env.production npm run db:seed`

### Puzzle config rules
- Grid: 15 wide (x: 0–14) × 20 tall (y: 0–19)
- `num_mirrors`: 8–11
- `splitters`: 0–2 per puzzle. Splitter puzzles are slower due to full simulation at each beam search step — use `--workers 12 --beam-width 6000` without `--v2` (expect ~9 min per puzzle)
- No duplicate obstacle layouts across puzzles

### Splitter semantics (easy to get wrong)
- `dir` = the direction a laser must travel to **trigger a split**
- `laser dir == dir` → split (perpendicular beams)
- `laser dir == opposite(dir)` → wall (blocked)
- otherwise → reflects toward `OPPOSITE[dir]`
- **Common mistake**: setting `dir=down` for a laser arriving LEFT — the laser just reflects UP, it doesn't split. Match `dir` to the laser's natural travel direction if you want a natural split.

### What makes a good layout
- **Obstacles must reach near the grid edges**, otherwise players ignore them and bounce around the perimeter. Thin central shapes (pentagons, rooms, totems) are easily bypassed.
- **Full-height/full-width walls with gaps** force engagement — the beam has no choice but to pass through the gap. Works well for "dungeon gates" or "column" themes.
- **Avoid isolated central shapes** with lots of open space around them — the optimal path just hugs the edges.
- **Splitter placement**: place the splitter where the laser can naturally reach it, with clear corridors in/out. Don't surround it with obstacles that block the split beams (especially directly above/below for UP/DOWN splits).
