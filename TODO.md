# TODO

## Mobile Support
The 15x20 grid at 40px per cell is 600x800 pixels, which is too wide for mobile screens.

Options to consider:
- Reduce cell size further on mobile (e.g., 25-30px)
- Use viewport-based sizing (vw/vh units)
- Add pinch-to-zoom or pan functionality
- Show a simplified/zoomed view on mobile
- Responsive breakpoints in useCanvas hook and GameCanvas component

Key files:
- `src/game/constants.ts` - CELL_SIZE constant
- `src/hooks/useCanvas.ts` - Canvas size calculation
- `src/components/game/GameCanvas.tsx` - Canvas rendering
- `src/app/game/[date]/page.tsx` - Layout structure

## Track and Display Best Score Per Level
Currently the game tracks best score but should ensure it's prominently displayed and persisted.

Requirements:
- Show current best score on the game page (already partially implemented in page.tsx)
- Ensure best score is saved to database for logged-in users (via /api/progress)
- Consider localStorage fallback for non-logged-in users
- Display best score in level select screen

Key files:
- `src/app/game/[date]/page.tsx` - Already shows previousBest
- `src/app/api/progress/route.ts` - Saves progress
- `prisma/schema.prisma` - LevelProgress model has bestScore field

## Allow Player to Restore Best Solution
Players should be able to load their previous best solution to continue improving from there.

Requirements:
- Save the mirror placement (solution) along with the best score
- Add "Load Best" button to restore the best solution's mirror positions
- Update game state to place mirrors from saved solution
- Only show button if a previous solution exists

Implementation:
- The LevelProgress model already has a `solution` JSON field
- Need to fetch and parse the saved solution
- Add UI button in GameControls or separate component
- Add handler in useGame hook to load a solution

Key files:
- `src/hooks/useGame.ts` - Add loadSolution function
- `src/components/game/GameControls.tsx` - Add "Load Best" button
- `src/app/game/[date]/page.tsx` - Fetch and pass saved solution
- `src/app/api/progress/route.ts` - Ensure solution is returned in GET
