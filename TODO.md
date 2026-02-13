# TODO

## ~~Mobile Support~~ ✓ DONE
~~The 15x20 grid at 40px per cell is 600x800 pixels, which is too wide for mobile screens.~~

Implemented:
- CSS transform scaling via ResponsiveCanvas component
- useResponsiveScale hook with ResizeObserver
- Touch handlers for mobile interaction
- Click cycle behavior (place → toggle → remove) eliminates need for right-click

## ~~Track and Display Best Score Per Level~~ ✓ DONE
~~Currently the game tracks best score but should ensure it's prominently displayed and persisted.~~

Implemented:
- Best score shown on game page
- Best score saved to localStorage
- Best score displayed in level select screen
- Removed star scoring system - now shows percentage of optimal score
- Level complete modal shows score as percentage (100% = Perfect!)

## ~~Allow Player to Restore Best Solution~~ ✓ DONE
~~Players should be able to load their previous best solution to continue improving from there.~~

Implemented:
- Best score shown in ScoreDisplay when current score is lower
- Tapping the score area restores the best solution
- Solution saved to localStorage
- loadSolution function in useGame hook

## ~~Push to GitHub~~ ✓ DONE
Repository: https://github.com/idealisms/laser-puzzle-game

## ~~Deploy to Vercel~~ ✓ DONE
~~Deploy the application to Vercel with PostgreSQL.~~

Implemented:
- Connected GitHub repo to Vercel
- Created Neon PostgreSQL database (laser_puzzle)
- Set DATABASE_URL environment variable
- Ran `npx prisma db push` to apply schema
- Seeded database with `npm run db:seed`

## Refactor Level Generation Pipeline
Move level generation and optimal path computation from `prisma/seed.ts` to Python, with a separate script for database insertion.

Tasks:
- [x] Update Python puzzle configs - Sync `solver/puzzles.py` with the current 15x20 grid configs from `seed.ts`
- [x] Add level generator to Python - Create `solver/generator.py` to generate new puzzle layouts
- [x] Improve optimal path solver - Path pruning (3-4x faster), recommend PyPy (5-10x faster)
- [x] Define JSON output format for generated levels
- [x] Create level insertion script - Read generated JSON and insert/upsert into database
- [x] Simplify seed.ts - Reduce to only read from pre-generated JSON files

- [x] Store generated levels as JSON files in `solver/levels/` for version control
- [x] Cache optimal solutions alongside levels
- [x] CLI to generate levels for specific dates or date ranges

## Add Analytics
Research and integrate analytics for tracking usage (personal use).

## ~~Add Twitch Login~~ — Decided not to implement
~~Add OAuth login via Twitch as an authentication option.~~

Login/auth system was built and then removed. The game works well with anonymous play only (localStorage + anonymous UUID for score submissions).

## ~~Server-Side Score Submissions & Leaderboard Histogram~~ ✓ DONE
~~Store mirror submissions on the server and compute the score server-side. Use the collected scores to generate a histogram on the show results modal as a form of leaderboard.~~

Implemented:
- Server-side score computation from mirror placements (prevents fake scores)
- ScoreSubmission model with one submission per player per level
- Anonymous player tracking via persistent UUID in localStorage
- Histogram API endpoint (GET /api/scores/histogram)
- Histogram component on the results modal showing score distribution
