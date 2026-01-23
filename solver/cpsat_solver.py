#!/usr/bin/env python3
"""
Laser Puzzle Solver using Google OR-Tools CP-SAT

This solver uses constraint programming to find the optimal mirror placement
that maximizes the laser path length.

The approach encodes the entire laser path symbolically with bounded time steps,
using constraints to model laser physics (movement, reflection, termination).
"""

from ortools.sat.python import cp_model
from puzzles import PuzzleConfig, Direction


# Direction deltas: [UP, RIGHT, DOWN, LEFT]
DX = [0, 1, 0, -1]
DY = [-1, 0, 1, 0]

# Reflection tables: new_direction = REFLECT[mirror_type][incoming_direction]
# mirror_type 0 = '\', mirror_type 1 = '/'
REFLECT = [
    # '\' mirror: up->left, right->down, down->right, left->up
    [int(Direction.LEFT), int(Direction.DOWN), int(Direction.RIGHT), int(Direction.UP)],
    # '/' mirror: up->right, right->up, down->left, left->down
    [int(Direction.RIGHT), int(Direction.UP), int(Direction.LEFT), int(Direction.DOWN)],
]


class LaserSolver:
    def __init__(self, config: PuzzleConfig, max_time: int = 60, verbose: bool = True):
        self.config = config
        self.max_time = max_time
        self.verbose = verbose

        self.W = config.width
        self.H = config.height
        self.num_cells = self.W * self.H

        # Compute valid cells
        self.obstacle_set = set(config.obstacles)
        self.invalid_cells = self.obstacle_set | {(config.laser_x, config.laser_y)}
        self.valid_cells = [
            (x, y) for x in range(self.W) for y in range(self.H)
            if (x, y) not in self.invalid_cells
        ]

    def cell_idx(self, x: int, y: int) -> int:
        return y * self.W + x

    def idx_to_xy(self, idx: int) -> tuple[int, int]:
        return idx % self.W, idx // self.W

    def solve(self, time_limit_seconds: int = 120) -> dict | None:
        """Solve the puzzle using CP-SAT."""
        model = cp_model.CpModel()
        config = self.config
        max_time = self.max_time

        # =====================================================================
        # DECISION VARIABLES: Mirror placement
        # =====================================================================
        has_mirror = {}
        mirror_type = {}

        for x, y in self.valid_cells:
            idx = self.cell_idx(x, y)
            has_mirror[idx] = model.new_bool_var(f'has_mirror_{x}_{y}')
            mirror_type[idx] = model.new_int_var(0, 1, f'mirror_type_{x}_{y}')

        # Constraint: at most num_mirrors mirrors placed
        model.add(sum(has_mirror.values()) <= config.num_mirrors)

        # =====================================================================
        # PATH VARIABLES: For each time step
        # =====================================================================
        pos_x = [model.new_int_var(0, self.W - 1, f'x_{t}') for t in range(max_time)]
        pos_y = [model.new_int_var(0, self.H - 1, f'y_{t}') for t in range(max_time)]
        direction = [model.new_int_var(0, 3, f'dir_{t}') for t in range(max_time)]
        alive = [model.new_bool_var(f'alive_{t}') for t in range(max_time)]

        # Step 0: laser starts at source
        model.add(pos_x[0] == config.laser_x)
        model.add(pos_y[0] == config.laser_y)
        model.add(direction[0] == int(config.laser_dir))
        model.add(alive[0] == True)

        # =====================================================================
        # TRANSITION CONSTRAINTS
        # =====================================================================
        for t in range(max_time - 1):
            # Direction-dependent deltas using element constraints
            dx_t = model.new_int_var(-1, 1, f'dx_{t}')
            dy_t = model.new_int_var(-1, 1, f'dy_{t}')
            model.add_element(direction[t], DX, dx_t)
            model.add_element(direction[t], DY, dy_t)

            # Candidate next position (unbounded for boundary check)
            next_x_unbounded = model.new_int_var(-1, self.W, f'next_x_ub_{t}')
            next_y_unbounded = model.new_int_var(-1, self.H, f'next_y_ub_{t}')
            model.add(next_x_unbounded == pos_x[t] + dx_t)
            model.add(next_y_unbounded == pos_y[t] + dy_t)

            # Check if out of bounds
            oob_left = model.new_bool_var(f'oob_left_{t}')
            oob_right = model.new_bool_var(f'oob_right_{t}')
            oob_top = model.new_bool_var(f'oob_top_{t}')
            oob_bottom = model.new_bool_var(f'oob_bottom_{t}')

            model.add(next_x_unbounded < 0).only_enforce_if(oob_left)
            model.add(next_x_unbounded >= 0).only_enforce_if(oob_left.negated())
            model.add(next_x_unbounded >= self.W).only_enforce_if(oob_right)
            model.add(next_x_unbounded < self.W).only_enforce_if(oob_right.negated())
            model.add(next_y_unbounded < 0).only_enforce_if(oob_top)
            model.add(next_y_unbounded >= 0).only_enforce_if(oob_top.negated())
            model.add(next_y_unbounded >= self.H).only_enforce_if(oob_bottom)
            model.add(next_y_unbounded < self.H).only_enforce_if(oob_bottom.negated())

            out_of_bounds = model.new_bool_var(f'oob_{t}')
            model.add_max_equality(out_of_bounds, [oob_left, oob_right, oob_top, oob_bottom])

            # Check if hit obstacle
            hit_obstacle = model.new_bool_var(f'hit_obs_{t}')
            if config.obstacles:
                obs_hits = []
                for ox, oy in config.obstacles:
                    is_ox = model.new_bool_var(f'is_ox_{t}_{ox}_{oy}')
                    is_oy = model.new_bool_var(f'is_oy_{t}_{ox}_{oy}')
                    model.add(next_x_unbounded == ox).only_enforce_if(is_ox)
                    model.add(next_x_unbounded != ox).only_enforce_if(is_ox.negated())
                    model.add(next_y_unbounded == oy).only_enforce_if(is_oy)
                    model.add(next_y_unbounded != oy).only_enforce_if(is_oy.negated())

                    both = model.new_bool_var(f'hit_{t}_{ox}_{oy}')
                    model.add_multiplication_equality(both, [is_ox, is_oy])
                    obs_hits.append(both)
                model.add_max_equality(hit_obstacle, obs_hits)
            else:
                model.add(hit_obstacle == False)

            # Termination condition
            terminates = model.new_bool_var(f'terminates_{t}')
            model.add_max_equality(terminates, [out_of_bounds, hit_obstacle])

            # Compute stays_alive
            stays_alive = model.new_bool_var(f'stays_alive_{t}')
            # stays_alive = alive[t] AND NOT terminates
            model.add(stays_alive == 1).only_enforce_if(alive[t], terminates.negated())
            model.add(stays_alive == 0).only_enforce_if(alive[t].negated())
            model.add(stays_alive == 0).only_enforce_if(terminates)

            model.add(alive[t + 1] == stays_alive)

            # Bounded next position (clamped to valid range when alive)
            next_x = model.new_int_var(0, self.W - 1, f'next_x_{t}')
            next_y = model.new_int_var(0, self.H - 1, f'next_y_{t}')

            # When in bounds, next_x/y equals unbounded version
            model.add(next_x == next_x_unbounded).only_enforce_if(out_of_bounds.negated())
            model.add(next_y == next_y_unbounded).only_enforce_if(out_of_bounds.negated())
            # When out of bounds, clamp to current position
            model.add(next_x == pos_x[t]).only_enforce_if(out_of_bounds)
            model.add(next_y == pos_y[t]).only_enforce_if(out_of_bounds)

            # Update position
            model.add(pos_x[t + 1] == next_x).only_enforce_if(stays_alive)
            model.add(pos_y[t + 1] == next_y).only_enforce_if(stays_alive)
            model.add(pos_x[t + 1] == pos_x[t]).only_enforce_if(stays_alive.negated())
            model.add(pos_y[t + 1] == pos_y[t]).only_enforce_if(stays_alive.negated())

            # Compute next cell index for mirror lookup
            next_cell = model.new_int_var(0, self.num_cells - 1, f'next_cell_{t}')
            model.add(next_cell == next_y * self.W + next_x)

            # Check for mirror at next cell
            hits_mirror = model.new_bool_var(f'hits_mirror_{t}')
            cell_mirror_hits = []

            for x, y in self.valid_cells:
                idx = self.cell_idx(x, y)
                is_this_cell = model.new_bool_var(f'is_cell_{t}_{x}_{y}')
                model.add(next_cell == idx).only_enforce_if(is_this_cell)
                model.add(next_cell != idx).only_enforce_if(is_this_cell.negated())

                hits_this_mirror = model.new_bool_var(f'hits_m_{t}_{x}_{y}')
                model.add_multiplication_equality(hits_this_mirror, [is_this_cell, has_mirror[idx]])
                cell_mirror_hits.append(hits_this_mirror)

            if cell_mirror_hits:
                model.add_max_equality(hits_mirror, cell_mirror_hits)
            else:
                model.add(hits_mirror == False)

            # Compute new direction with reflection
            new_direction = model.new_int_var(0, 3, f'new_dir_{t}')

            # Default: keep same direction if no mirror
            model.add(new_direction == direction[t]).only_enforce_if(hits_mirror.negated())

            # If we hit a mirror, apply reflection
            for x, y in self.valid_cells:
                idx = self.cell_idx(x, y)
                is_this_cell = model.new_bool_var(f'refl_cell_{t}_{x}_{y}')
                model.add(next_cell == idx).only_enforce_if(is_this_cell)
                model.add(next_cell != idx).only_enforce_if(is_this_cell.negated())

                for mtype in [0, 1]:
                    is_this_type = model.new_bool_var(f'mtype_{t}_{x}_{y}_{mtype}')
                    model.add(mirror_type[idx] == mtype).only_enforce_if(is_this_type)
                    model.add(mirror_type[idx] != mtype).only_enforce_if(is_this_type.negated())

                    for old_dir in range(4):
                        reflected_dir = REFLECT[mtype][old_dir]

                        is_old_dir = model.new_bool_var(f'old_dir_{t}_{x}_{y}_{mtype}_{old_dir}')
                        model.add(direction[t] == old_dir).only_enforce_if(is_old_dir)
                        model.add(direction[t] != old_dir).only_enforce_if(is_old_dir.negated())

                        # All conditions: this cell, has mirror, this type, this direction
                        all_conds = model.new_bool_var(f'all_refl_{t}_{x}_{y}_{mtype}_{old_dir}')
                        model.add_multiplication_equality(all_conds, [
                            is_this_cell, has_mirror[idx], is_this_type, is_old_dir
                        ])

                        model.add(new_direction == reflected_dir).only_enforce_if(all_conds)

            # Set next direction
            model.add(direction[t + 1] == new_direction).only_enforce_if(stays_alive)
            model.add(direction[t + 1] == direction[t]).only_enforce_if(stays_alive.negated())

        # =====================================================================
        # OBJECTIVE: Maximize path length
        # =====================================================================
        # Path length = number of moves made
        # If alive[t]=True and we transition, we made a move (even if it terminates)
        # alive[0] represents being at source before any move
        # sum(alive) counts positions we reached, which equals moves made
        path_length = model.new_int_var(0, max_time, 'path_length')
        model.add(path_length == sum(alive))
        model.maximize(path_length)

        # =====================================================================
        # SOLVE
        # =====================================================================
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = time_limit_seconds
        solver.parameters.num_workers = 8

        if self.verbose:
            print(f"Solving '{config.name}' ({self.W}x{self.H} grid, {config.num_mirrors} mirrors)...")
            print(f"Laser: ({config.laser_x}, {config.laser_y}) -> {Direction(config.laser_dir).name}")
            print(f"Obstacles: {len(config.obstacles)}, Valid cells: {len(self.valid_cells)}")

        status = solver.solve(model)

        if status == cp_model.OPTIMAL:
            status_str = "OPTIMAL"
        elif status == cp_model.FEASIBLE:
            status_str = "FEASIBLE"
        else:
            if self.verbose:
                print(f"No solution found. Status: {solver.status_name(status)}")
            return None

        best_length = solver.value(path_length)

        mirrors_placed = []
        for x, y in self.valid_cells:
            idx = self.cell_idx(x, y)
            if solver.value(has_mirror[idx]):
                mtype = solver.value(mirror_type[idx])
                type_char = '\\' if mtype == 0 else '/'
                mirrors_placed.append((x, y, type_char))

        if self.verbose:
            print(f"\n{status_str} solution found!")
            print(f"Path length: {best_length}")
            print(f"Mirrors placed: {len(mirrors_placed)}")
            for x, y, t in mirrors_placed:
                print(f"  ({x}, {y}) -> {t}")
            print(f"Solve time: {solver.wall_time:.2f}s")

        return {
            'status': status_str,
            'path_length': best_length,
            'mirrors': mirrors_placed,
            'solve_time': solver.wall_time,
        }


def solve_puzzle(config: PuzzleConfig, max_time: int = 60, time_limit: int = 120, verbose: bool = True) -> dict | None:
    """Convenience function to solve a puzzle."""
    solver = LaserSolver(config, max_time=max_time, verbose=verbose)
    return solver.solve(time_limit_seconds=time_limit)


if __name__ == '__main__':
    from puzzles import PUZZLES

    # Test with the Cross Pattern puzzle
    config = PUZZLES[4]  # Cross Pattern
    result = solve_puzzle(config, max_time=50, time_limit=120)

    if result:
        print(f"\n{'=' * 50}")
        print(f"Final result for '{config.name}':")
        print(f"  Path length: {result['path_length']}")
        print(f"  Status: {result['status']}")
