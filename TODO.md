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
- Best score shown on game page for both logged-in and guest users
- Best score saved to database for logged-in users
- localStorage fallback for non-logged-in users
- Best score displayed in level select screen alongside stars

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
