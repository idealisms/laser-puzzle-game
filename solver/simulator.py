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


def get_split_directions(direction: Direction) -> tuple[Direction, Direction]:
    """Return the two perpendicular directions for a beam splitting at a splitter."""
    if direction in (Direction.LEFT, Direction.RIGHT):
        return (Direction.UP, Direction.DOWN)
    return (Direction.LEFT, Direction.RIGHT)


def opposite_direction(direction: Direction) -> Direction:
    """Return the direction opposite to the given direction."""
    return {
        Direction.UP: Direction.DOWN,
        Direction.DOWN: Direction.UP,
        Direction.LEFT: Direction.RIGHT,
        Direction.RIGHT: Direction.LEFT,
    }[direction]


def get_splitter_action(laser_dir: Direction, orientation: str) -> str:
    """
    Return 'split', 'wall', or 'reflect' for a laser hitting a directional splitter.

    - orientation: the direction a laser must travel to trigger a split
    - laser traveling in orientation direction → 'split' (perpendicular beams)
    - laser traveling opposite to orientation → 'wall' (blocked)
    - laser traveling perpendicular to orientation → 'reflect' back toward opposite(orientation)
    """
    orientation_dir = Direction.from_string(orientation)
    if laser_dir == orientation_dir:
        return 'split'
    if laser_dir == opposite_direction(orientation_dir):
        return 'wall'
    return 'reflect'


def resolve_collisions(
    streams: list[list[tuple]],
    stream_offsets: list[int],
) -> list[tuple]:
    """
    Detect laser beam collisions and truncate streams in place.

    Matches the JS resolveCollisions behaviour:
      1. Same-cell same-time: beams from different streams arrive at the same
         cell at the same global time, regardless of direction or cell content.
         This covers head-on, perpendicular, and same-direction beams — any two
         beams sharing the same point in space and time count as a collision.
      2. Crossing: at the same global time, beam A is at cell P heading toward Q
         and beam B is at Q heading toward P (adjacent cells, opposite directions).

    Per stream-pair, only the earliest collision is kept.  Both affected streams
    are then truncated to include the collision step as the final step.

    Each step in a stream is (nx, ny, incoming_dir) where:
      - (nx, ny) is the cell reached
      - incoming_dir is the direction of travel used to reach that cell
      - global time for step i in stream s with offset o is: o + i + 1

    Args:
        streams: list of step lists; mutated in place on truncation
        stream_offsets: global offset for each stream

    Returns:
        list of collision positions as (x, y) or (x+0.5, y+0.5) tuples
    """
    # by_cell_time: (x, y, g_time) -> [(si, segi, dir), ...]
    # by_time:      g_time         -> [(si, segi, x, y, dir), ...]
    by_cell_time: dict = {}
    by_time: dict = {}

    for si, (offset, steps) in enumerate(zip(stream_offsets, streams)):
        for segi, (x, y, d) in enumerate(steps):
            g_time = offset + segi + 1
            by_cell_time.setdefault((x, y, g_time), []).append((si, segi, d))
            by_time.setdefault(g_time, []).append((si, segi, x, y, d))

    # Per stream-pair: keep only the earliest collision
    pair_collisions: dict = {}  # (lo_si, hi_si) -> (g_time, pos, a_info, b_info)

    def try_collision(g_time, pos, a_si, a_segi, b_si, b_segi):
        lo, hi = min(a_si, b_si), max(a_si, b_si)
        key = (lo, hi)
        if key not in pair_collisions or g_time < pair_collisions[key][0]:
            pair_collisions[key] = (g_time, pos, (a_si, a_segi), (b_si, b_segi))

    # 1. Same-cell same-time: any two beams from different streams at the same cell at
    #    the same global time — regardless of direction or whether a mirror is present.
    for (x, y, g_time), arrivals in by_cell_time.items():
        if len(arrivals) < 2:
            continue
        for i in range(len(arrivals)):
            for j in range(i + 1, len(arrivals)):
                a_si, a_segi, a_dir = arrivals[i]
                b_si, b_segi, b_dir = arrivals[j]
                if a_si != b_si:
                    try_collision(g_time, (x, y), a_si, a_segi, b_si, b_segi)

    # 2. Crossing: at same g_time, A at P heading toward Q, B at Q heading toward P
    for g_time, arrivals in by_time.items():
        if len(arrivals) < 2:
            continue
        for i in range(len(arrivals)):
            for j in range(i + 1, len(arrivals)):
                a_si, a_segi, ax, ay, a_dir = arrivals[i]
                b_si, b_segi, bx, by, b_dir = arrivals[j]
                if a_si == b_si:
                    continue
                if a_dir != opposite_direction(b_dir):
                    continue
                ddx, ddy = DELTAS[a_dir]
                if bx == ax + ddx and by == ay + ddy:
                    pos = ((ax + bx) / 2, (ay + by) / 2)
                    try_collision(g_time, pos, a_si, a_segi, b_si, b_segi)

    # Apply truncations: keep steps 0..max_segi (inclusive) per stream
    truncations: dict[int, int] = {}
    collision_positions = []

    for _g_time, pos, (a_si, a_segi), (b_si, b_segi) in pair_collisions.values():
        collision_positions.append(pos)
        truncations[a_si] = min(truncations.get(a_si, a_segi), a_segi)
        truncations[b_si] = min(truncations.get(b_si, b_segi), b_segi)

    for si, max_segi in truncations.items():
        streams[si] = streams[si][:max_segi + 1]

    return collision_positions


def simulate_laser(
    config: PuzzleConfig,
    mirrors: list[tuple[int, int, str]],
    max_length: int = 1000,
    obstacle_set: set[tuple[int, int]] | None = None,
    splitter_map: dict[tuple[int, int], str] | None = None,
) -> dict:
    """
    Simulate laser path and return path details.

    Supports directional splitters and head-on beam collision detection.
    Collision detection matches the JS resolveCollisions logic: beams from
    different split branches that meet head-on are truncated at the collision
    point, reducing the reported path length.

    Args:
        config: Puzzle configuration
        mirrors: List of (x, y, type) tuples where type is '/' or '\\'
        obstacle_set: Pre-computed wall obstacle set (optional, computed if not provided)
        splitter_map: Pre-computed {(x,y): orientation} map (optional, computed if not provided)

    Returns:
        dict with 'length', 'path', 'termination_reason'
    """
    mirror_map = {(x, y): t for x, y, t in mirrors}
    if obstacle_set is None:
        obstacle_set = set(config.obstacles)
    if splitter_map is None:
        splitter_map = {(x, y): orientation for x, y, orientation in getattr(config, 'splitters', [])}

    # DFS stack entries: (start_x, start_y, start_dir, global_offset)
    # global_offset = total steps from the laser source before this stream started
    stack = [(config.laser_x, config.laser_y, config.laser_dir, 0)]
    visited: set = set()

    # streams[i] = list of (nx, ny, incoming_dir) steps
    # stream_offsets[i] = global offset for stream i
    streams: list[list] = []
    stream_offsets: list[int] = []

    termination_reason = 'max_length'
    total_steps = 0

    while stack and total_steps < max_length:
        start_x, start_y, start_dir, global_offset = stack.pop()
        stream_steps: list = []

        x, y, direction = start_x, start_y, start_dir

        while total_steps < max_length:
            state = (x, y, direction)
            if state in visited:
                termination_reason = 'loop'
                break
            visited.add(state)

            dx, dy = DELTAS[direction]
            next_x, next_y = x + dx, y + dy
            # step records: destination cell + the incoming direction used to reach it
            step = (next_x, next_y, direction)

            # Out of bounds
            if next_x < 0 or next_x >= config.width or next_y < 0 or next_y >= config.height:
                stream_steps.append(step)
                total_steps += 1
                termination_reason = 'edge'
                break

            # Wall obstacle
            if (next_x, next_y) in obstacle_set:
                stream_steps.append(step)
                total_steps += 1
                termination_reason = 'obstacle'
                break

            # Splitter
            if (next_x, next_y) in splitter_map:
                orientation = splitter_map[(next_x, next_y)]
                action = get_splitter_action(direction, orientation)
                stream_steps.append(step)
                total_steps += 1
                if action == 'split':
                    dir1, dir2 = get_split_directions(direction)
                    sub_offset = global_offset + len(stream_steps)
                    stack.append((next_x, next_y, dir1, sub_offset))
                    stack.append((next_x, next_y, dir2, sub_offset))
                    break
                elif action == 'wall':
                    termination_reason = 'obstacle'
                    break
                else:  # reflect
                    direction = opposite_direction(Direction.from_string(orientation))
                    x, y = next_x, next_y
                    continue

            # Normal move (may land on a mirror)
            stream_steps.append(step)
            total_steps += 1
            x, y = next_x, next_y
            if (x, y) in mirror_map:
                direction = REFLECT[mirror_map[(x, y)]][direction]

        streams.append(stream_steps)
        stream_offsets.append(global_offset)

    # Detect and truncate beam collisions (matches JS resolveCollisions)
    resolve_collisions(streams, stream_offsets)

    # Total length = sum of all stream lengths after collision truncation
    total_length = sum(len(s) for s in streams)

    # Build backward-compatible path from the primary stream.
    # Format: [(x, y, dir_leaving_cell), ...] starting with the laser source.
    # This format is used by simulate_incremental for no-splitter puzzles.
    path = [(config.laser_x, config.laser_y, config.laser_dir)]
    if streams:
        for nx, ny, incoming_dir in streams[0]:
            if (nx, ny) in mirror_map:
                path_dir = REFLECT[mirror_map[(nx, ny)]][incoming_dir]
            else:
                path_dir = incoming_dir
            path.append((nx, ny, path_dir))

    # all_cells: every cell visited across ALL streams (used for candidate generation)
    all_cells = {(nx, ny) for stream in streams for nx, ny, _ in stream}

    return {
        'length': total_length,
        'path': path,
        'all_cells': all_cells,
        'termination_reason': termination_reason,
    }


def simulate_incremental(
    config: PuzzleConfig,
    obstacle_set: set[tuple[int, int]],
    existing_mirrors: list[tuple[int, int, str]],
    existing_path: list[tuple[int, int, Direction]],
    existing_length: int,
    new_mirror: tuple[int, int, str],
    max_length: int = 1000,
    splitter_map: dict[tuple[int, int], str] | None = None,
    existing_all_cells: set[tuple[int, int]] | None = None,
) -> dict:
    """
    Simulate adding a single new mirror to an existing configuration.

    Optimization: if the new mirror is not on the existing path, it has no effect.
    If it is on the path, only simulate from that point forward.

    Args:
        config: Puzzle configuration
        obstacle_set: Pre-computed obstacle set
        existing_mirrors: Current mirror placements
        existing_path: Path from simulating existing_mirrors
        existing_length: Length from simulating existing_mirrors
        new_mirror: The new mirror to add (x, y, type)
        existing_all_cells: All cells visited across all streams (for candidate gen)

    Returns:
        dict with 'length', 'path', 'all_cells', 'termination_reason'
    """
    if splitter_map is None:
        splitter_map = {(x, y): orientation for x, y, orientation in getattr(config, 'splitters', [])}

    # If there are splitters, fall back to full simulation (correctness > performance)
    if splitter_map:
        return simulate_laser(
            config,
            existing_mirrors + [new_mirror],
            max_length=max_length,
            obstacle_set=obstacle_set,
            splitter_map=splitter_map,
        )

    # For unchanged returns, fall back to computing from path if not provided
    _existing_all_cells = existing_all_cells if existing_all_cells is not None \
        else {(x, y) for x, y, _ in existing_path}

    mx, my, mtype = new_mirror

    # Find if and where the new mirror appears on the existing path
    mirror_index = None
    for i, (px, py, _) in enumerate(existing_path):
        if px == mx and py == my:
            mirror_index = i
            break

    # If mirror not on path, it has no effect
    if mirror_index is None:
        return {
            'length': existing_length,
            'path': existing_path,
            'all_cells': _existing_all_cells,
            'termination_reason': 'unchanged',
        }

    # If mirror is at starting position (index 0), it has no effect
    # (laser starts there, doesn't "enter" it)
    if mirror_index == 0:
        return {
            'length': existing_length,
            'path': existing_path,
            'all_cells': _existing_all_cells,
            'termination_reason': 'unchanged',
        }

    # Get the incoming direction at the mirror position
    # The laser was traveling in the direction from the previous path step
    _, _, incoming_dir = existing_path[mirror_index - 1]

    # Apply reflection from new mirror
    new_dir = REFLECT[mtype][incoming_dir]

    # Check if direction actually changes
    _, _, existing_dir_at_mirror = existing_path[mirror_index]
    if new_dir == existing_dir_at_mirror:
        return {
            'length': existing_length,
            'path': existing_path,
            'all_cells': _existing_all_cells,
            'termination_reason': 'unchanged',
        }

    # Build full mirror map including the new mirror
    mirror_map = {(x, y): t for x, y, t in existing_mirrors}
    mirror_map[(mx, my)] = mtype

    # Start from mirror position with new direction
    x, y = mx, my
    direction = new_dir
    length = mirror_index  # Steps taken to reach the mirror position

    # Reuse path up to mirror position, then update with new direction
    new_path = list(existing_path[:mirror_index])
    new_path.append((x, y, direction))

    # Track visited states - include all states from the preserved path
    visited = {(px, py, pd) for px, py, pd in new_path}

    # Continue simulation from mirror position
    while length < max_length:
        # Move in current direction
        dx, dy = DELTAS[direction]
        next_x, next_y = x + dx, y + dy

        # Check bounds
        if next_x < 0 or next_x >= config.width or next_y < 0 or next_y >= config.height:
            length += 1
            return {
                'length': length,
                'path': new_path,
                'all_cells': {(x, y) for x, y, _ in new_path},
                'termination_reason': 'edge',
            }

        # Check obstacle
        if (next_x, next_y) in obstacle_set:
            length += 1
            return {
                'length': length,
                'path': new_path,
                'all_cells': {(x, y) for x, y, _ in new_path},
                'termination_reason': 'obstacle',
            }

        # Move to next cell
        length += 1
        x, y = next_x, next_y

        # Check for mirror and reflect
        if (x, y) in mirror_map:
            mirror_type = mirror_map[(x, y)]
            direction = REFLECT[mirror_type][direction]

        # Check for loop
        state = (x, y, direction)
        if state in visited:
            return {
                'length': length,
                'path': new_path,
                'all_cells': {(x, y) for x, y, _ in new_path},
                'termination_reason': 'loop',
            }
        visited.add(state)
        new_path.append((x, y, direction))

    return {
        'length': length,
        'path': new_path,
        'all_cells': {(x, y) for x, y, _ in new_path},
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
    all_cells: set[tuple[int, int]],
    config: PuzzleConfig,
    used_positions: set[tuple[int, int]],
    invalid_positions: set[tuple[int, int]],
) -> list[tuple[int, int]]:
    """
    Get candidate positions for mirror placement based on all beam cells.
    Only returns cells on any beam (primary or sub-beams) — mirrors elsewhere have no effect.
    """
    # Only consider cells on any beam (mirrors elsewhere have no effect)
    candidates = all_cells - invalid_positions - used_positions

    return list(candidates)


def beam_search_solver(
    config: PuzzleConfig,
    beam_width: int = 2000,
    verbose: bool = False,
    use_path_pruning: bool = True,
) -> dict:
    """
    Beam search solver with incremental simulation for better performance.

    Optimizations:
    - Pre-computes obstacle_set once instead of per-simulation
    - Uses incremental simulation: only re-simulates from the new mirror position
    - Path pruning: only considers positions on/adjacent to laser path

    For best performance, run with PyPy: pypy3 solve.py ...

    Args:
        config: Puzzle configuration
        beam_width: Number of top candidates to keep at each step
        verbose: Print progress updates
        use_path_pruning: Only consider positions on/adjacent to laser path (faster)
    """
    # Pre-compute obstacle and splitter maps once (instead of per-simulation)
    obstacle_set = set(config.obstacles)
    splitter_map = {(x, y): orientation for x, y, orientation in getattr(config, 'splitters', [])}
    laser_pos = (config.laser_x, config.laser_y)
    invalid_positions = obstacle_set | set(splitter_map.keys()) | {laser_pos}
    valid_positions = [
        (x, y) for x in range(config.width) for y in range(config.height)
        if (x, y) not in invalid_positions
    ]

    best_score = 0
    best_mirrors = []
    mirror_types = ['/', '\\']

    # Get initial path (no mirrors) - use pre-computed obstacle_set and splitter_map
    initial_result = simulate_laser(config, [], obstacle_set=obstacle_set, splitter_map=splitter_map)
    initial_path = initial_result['path']
    initial_length = initial_result['length']
    initial_all_cells = initial_result['all_cells']

    # Beam search
    for num_mirrors in range(1, config.num_mirrors + 1):
        # Start with empty configuration and its path
        candidates = [{'mirrors': [], 'score': initial_length, 'path': initial_path, 'all_cells': initial_all_cells}]

        for depth in range(num_mirrors):
            next_candidates = []

            for candidate in candidates:
                used_positions = {(m[0], m[1]) for m in candidate['mirrors']}

                # Get positions to consider
                if use_path_pruning:
                    positions = get_candidate_positions(
                        candidate['all_cells'], config, used_positions, invalid_positions
                    )
                else:
                    positions = [p for p in valid_positions if p not in used_positions]

                # Evaluate each candidate position with incremental simulation
                for pos in positions:
                    for mtype in mirror_types:
                        new_mirror = (pos[0], pos[1], mtype)

                        # Use incremental simulation - only re-simulate from new mirror
                        result = simulate_incremental(
                            config,
                            obstacle_set,
                            candidate['mirrors'],
                            candidate['path'],
                            candidate['score'],
                            new_mirror,
                            splitter_map=splitter_map,
                            existing_all_cells=candidate['all_cells'],
                        )

                        new_mirrors = candidate['mirrors'] + [new_mirror]
                        next_candidates.append({
                            'mirrors': new_mirrors,
                            'score': result['length'],
                            'path': result['path'],
                            'all_cells': result['all_cells'],
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
