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
- Best score displayed in level select screen
- Removed star scoring system - now shows percentage of optimal score
- Level complete modal shows score as percentage (100% = Perfect!)

## ~~Allow Player to Restore Best Solution~~ ✓ DONE
~~Players should be able to load their previous best solution to continue improving from there.~~

Implemented:
- Best score shown in ScoreDisplay when current score is lower
- Tapping the score area restores the best solution
- Solution saved to database for logged-in users
- Solution saved to localStorage for guest users
- loadSolution function in useGame hook
