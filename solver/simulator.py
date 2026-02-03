"""
Laser path simulator - computes path length for a given mirror configuration.
Used for verifying solver solutions and as a baseline.

Note: Run with PyPy for 5-10x faster execution: pypy3 solve.py ...
"""

from puzzles import PuzzleConfig, Direction


# Direction deltas
DELTAS = {
    Direction.UP: (0, -1),
    Direction.DOWN: (0, 1),
    Direction.LEFT: (-1, 0),
    Direction.RIGHT: (1, 0),
}

# Reflection rules
# REFLECT[mirror_type][incoming_direction] = outgoing_direction
REFLECT = {
    '\\': {
        Direction.UP: Direction.LEFT,
        Direction.RIGHT: Direction.DOWN,
        Direction.DOWN: Direction.RIGHT,
        Direction.LEFT: Direction.UP,
    },
    '/': {
        Direction.UP: Direction.RIGHT,
        Direction.RIGHT: Direction.UP,
        Direction.DOWN: Direction.LEFT,
        Direction.LEFT: Direction.DOWN,
    },
}


def simulate_laser(
    config: PuzzleConfig,
    mirrors: list[tuple[int, int, str]],
    max_length: int = 1000
) -> dict:
    """
    Simulate laser path and return path details.

    Args:
        config: Puzzle configuration
        mirrors: List of (x, y, type) tuples where type is '/' or '\\'

    Returns:
        dict with 'length', 'path', 'termination_reason'
    """
    # Build mirror lookup
    mirror_map = {(x, y): t for x, y, t in mirrors}
    obstacle_set = set(config.obstacles)

    # Start position and direction
    x, y = config.laser_x, config.laser_y
    direction = config.laser_dir

    # Track visited states to detect loops
    visited = set()
    path = [(x, y, direction)]
    length = 0

    while length < max_length:
        state = (x, y, direction)
        if state in visited:
            return {
                'length': length,
                'path': path,
                'termination_reason': 'loop',
            }
        visited.add(state)

        # Move in current direction
        dx, dy = DELTAS[direction]
        next_x, next_y = x + dx, y + dy

        # Check bounds
        if next_x < 0 or next_x >= config.width or next_y < 0 or next_y >= config.height:
            length += 1
            return {
                'length': length,
                'path': path,
                'termination_reason': 'edge',
            }

        # Check obstacle
        if (next_x, next_y) in obstacle_set:
            length += 1
            return {
                'length': length,
                'path': path,
                'termination_reason': 'obstacle',
            }

        # Move to next cell
        length += 1
        x, y = next_x, next_y

        # Check for mirror and reflect
        if (x, y) in mirror_map:
            mirror_type = mirror_map[(x, y)]
            direction = REFLECT[mirror_type][direction]

        path.append((x, y, direction))

    return {
        'length': length,
        'path': path,
        'termination_reason': 'max_length',
    }


def verify_solution(config: PuzzleConfig, mirrors: list[tuple[int, int, str]], expected_length: int) -> bool:
    """Verify that a mirror configuration achieves the expected path length."""
    result = simulate_laser(config, mirrors)
    return result['length'] == expected_length


def get_path_cells(path: list[tuple[int, int, Direction]]) -> set[tuple[int, int]]:
    """Extract unique cell positions from a laser path."""
    return {(x, y) for x, y, _ in path}


def get_candidate_positions(
    path: list[tuple[int, int, Direction]],
    config: PuzzleConfig,
    used_positions: set[tuple[int, int]],
    invalid_positions: set[tuple[int, int]],
) -> list[tuple[int, int]]:
    """
    Get candidate positions for mirror placement based on current path.
    Returns cells on the path and adjacent to the path, excluding invalid positions.
    """
    path_cells = get_path_cells(path)
    candidates = set()

    # Add cells on the path
    candidates.update(path_cells)

    # Add cells adjacent to path (mirrors here could redirect laser onto path)
    for x, y in path_cells:
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if 0 <= nx < config.width and 0 <= ny < config.height:
                candidates.add((nx, ny))

    # Remove invalid and already-used positions
    candidates -= invalid_positions
    candidates -= used_positions

    return list(candidates)


def beam_search_solver(
    config: PuzzleConfig,
    beam_width: int = 500,
    random_iterations: int = 10000,
    verbose: bool = False,
    use_path_pruning: bool = True,
) -> dict:
    """
    Beam search + random search solver with path-based pruning.

    Path pruning dramatically reduces search space by only considering mirror
    positions on or adjacent to the current laser path (~4x speedup).

    For best performance, run with PyPy: pypy3 solve.py ...

    Args:
        config: Puzzle configuration
        beam_width: Number of top candidates to keep at each step
        random_iterations: Number of random configurations to try
        verbose: Print progress updates
        use_path_pruning: Only consider positions on/adjacent to laser path (faster)
    """
    import random

    # Get valid positions
    obstacle_set = set(config.obstacles)
    laser_pos = (config.laser_x, config.laser_y)
    invalid_positions = obstacle_set | {laser_pos}
    valid_positions = [
        (x, y) for x in range(config.width) for y in range(config.height)
        if (x, y) not in invalid_positions
    ]

    best_score = 0
    best_mirrors = []
    mirror_types = ['/', '\\']

    # Get initial path (no mirrors)
    initial_result = simulate_laser(config, [])
    initial_path = initial_result['path']

    # Beam search
    for num_mirrors in range(1, config.num_mirrors + 1):
        # Start with empty configuration and its path
        candidates = [{'mirrors': [], 'score': 0, 'path': initial_path}]

        for depth in range(num_mirrors):
            next_candidates = []

            for candidate in candidates:
                used_positions = {(m[0], m[1]) for m in candidate['mirrors']}

                # Get positions to consider
                if use_path_pruning:
                    positions = get_candidate_positions(
                        candidate['path'], config, used_positions, invalid_positions
                    )
                else:
                    positions = [p for p in valid_positions if p not in used_positions]

                # Evaluate each candidate position
                for pos in positions:
                    for mtype in mirror_types:
                        new_mirrors = candidate['mirrors'] + [(pos[0], pos[1], mtype)]
                        result = simulate_laser(config, new_mirrors)
                        next_candidates.append({
                            'mirrors': new_mirrors,
                            'score': result['length'],
                            'path': result['path'],
                        })

                        if result['length'] > best_score:
                            best_score = result['length']
                            best_mirrors = new_mirrors
                            if verbose:
                                print(f"  New best: {best_score} with {len(best_mirrors)} mirrors")

            # Keep top candidates
            next_candidates.sort(key=lambda c: c['score'], reverse=True)
            candidates = next_candidates[:beam_width]

            if not candidates:
                break

    # Random search (path-aware)
    for i in range(random_iterations):
        mirrors = []
        used_positions = set()
        # Get current path for pruning
        current_result = simulate_laser(config, mirrors)
        current_path = current_result['path']

        for _ in range(config.num_mirrors):
            if use_path_pruning:
                available = get_candidate_positions(
                    current_path, config, used_positions, invalid_positions
                )
            else:
                available = [p for p in valid_positions if p not in used_positions]

            if not available:
                break

            pos = random.choice(available)
            mtype = random.choice(mirror_types)
            mirrors.append((pos[0], pos[1], mtype))
            used_positions.add(pos)

            # Update path for next iteration
            current_result = simulate_laser(config, mirrors)
            current_path = current_result['path']

        if current_result['length'] > best_score:
            best_score = current_result['length']
            best_mirrors = mirrors
            if verbose:
                print(f"  Random found: {best_score}")

    return {
        'path_length': best_score,
        'mirrors': best_mirrors,
    }


if __name__ == '__main__':
    from puzzles import PUZZLES

    print("Testing simulator with beam search solver...\n")

    for i, config in enumerate(PUZZLES):
        print(f"Puzzle {i}: {config.name}")
        result = beam_search_solver(config, verbose=False)
        print(f"  Best path length: {result['path_length']}")
        print(f"  Mirrors: {result['mirrors']}")
        print()
