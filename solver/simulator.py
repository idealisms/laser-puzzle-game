"""
Laser path simulator - computes path length for a given mirror configuration.
Used for verifying solver solutions and as a baseline.
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


def beam_search_solver(
    config: PuzzleConfig,
    beam_width: int = 500,
    random_iterations: int = 10000,
    verbose: bool = False
) -> dict:
    """
    Beam search + random search solver (same algorithm as seed.ts).
    Used as baseline for comparison.
    """
    import random

    # Get valid positions
    obstacle_set = set(config.obstacles)
    laser_pos = (config.laser_x, config.laser_y)
    valid_positions = [
        (x, y) for x in range(config.width) for y in range(config.height)
        if (x, y) not in obstacle_set and (x, y) != laser_pos
    ]

    best_score = 0
    best_mirrors = []
    mirror_types = ['/', '\\']

    # Beam search
    for num_mirrors in range(1, config.num_mirrors + 1):
        candidates = [{'mirrors': [], 'score': 0}]

        for depth in range(num_mirrors):
            next_candidates = []

            for candidate in candidates:
                used_positions = {(m[0], m[1]) for m in candidate['mirrors']}

                for pos in valid_positions:
                    if pos in used_positions:
                        continue

                    for mtype in mirror_types:
                        new_mirrors = candidate['mirrors'] + [(pos[0], pos[1], mtype)]
                        result = simulate_laser(config, new_mirrors)
                        score = result['length']
                        next_candidates.append({'mirrors': new_mirrors, 'score': score})

                        if score > best_score:
                            best_score = score
                            best_mirrors = new_mirrors
                            if verbose:
                                print(f"  New best: {score} with {len(new_mirrors)} mirrors")

            next_candidates.sort(key=lambda c: c['score'], reverse=True)
            candidates = next_candidates[:beam_width]

    # Random search
    for i in range(random_iterations):
        mirrors = []
        used_positions = set()

        for _ in range(config.num_mirrors):
            available = [p for p in valid_positions if p not in used_positions]
            if not available:
                break

            pos = random.choice(available)
            mtype = random.choice(mirror_types)
            mirrors.append((pos[0], pos[1], mtype))
            used_positions.add(pos)

        result = simulate_laser(config, mirrors)
        if result['length'] > best_score:
            best_score = result['length']
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
