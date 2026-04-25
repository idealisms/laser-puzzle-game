/**
 * Shuffle puzzle/level files across a date range while respecting constraints:
 * - No consecutive splitters
 * - No consecutive large-grid puzzles
 * - Large grids spaced at least 14 days apart
 *
 * Usage: npx tsx shuffle_puzzles.ts --start YYYY-MM-DD --end YYYY-MM-DD [--seed N]
 */

import * as fs from "fs";
import * as path from "path";

const args = process.argv.slice(2);
const getArg = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const startArg = getArg("start") ?? "2026-04-28";
const endArg = getArg("end") ?? "2026-06-30";
const seedArg = parseInt(getArg("seed") ?? "42", 10);

function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

// Seeded PRNG (mulberry32)
function makePrng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type PuzzleType = "standard" | "gate" | "splitter" | "large";

interface PuzzleInfo {
  date: string;
  name: string;
  type: PuzzleType;
}

function getPuzzleType(puzzleConfig: Record<string, unknown>): PuzzleType {
  const isLarge =
    ((puzzleConfig.width as number) ?? 15) > 15 ||
    ((puzzleConfig.height as number) ?? 20) > 20;
  const hasSplitter =
    Array.isArray(puzzleConfig.splitters) && puzzleConfig.splitters.length > 0;
  const hasGate =
    Array.isArray(puzzleConfig.gates) && puzzleConfig.gates.length > 0;
  if (isLarge) return "large";
  if (hasSplitter) return "splitter";
  if (hasGate) return "gate";
  return "standard";
}

function checkConstraints(assignment: PuzzleInfo[]): boolean {
  for (let i = 1; i < assignment.length; i++) {
    const prev = assignment[i - 1];
    const curr = assignment[i];
    if (prev.type === "splitter" && curr.type === "splitter") return false;
    if (prev.type === "large" && curr.type === "large") return false;
  }
  // Large grids must be at least 14 days apart
  const largeIndices = assignment
    .map((p, i) => (p.type === "large" ? i : -1))
    .filter((i) => i >= 0);
  for (let i = 1; i < largeIndices.length; i++) {
    if (largeIndices[i] - largeIndices[i - 1] < 14) return false;
  }
  return true;
}

function tryFix(
  assignment: PuzzleInfo[],
  rand: () => number,
  maxSwaps = 10000
): boolean {
  for (let attempt = 0; attempt < maxSwaps; attempt++) {
    if (checkConstraints(assignment)) return true;
    // Find a violated position
    const violations: number[] = [];
    for (let i = 1; i < assignment.length; i++) {
      const prev = assignment[i - 1];
      const curr = assignment[i];
      if (
        (prev.type === "splitter" && curr.type === "splitter") ||
        (prev.type === "large" && curr.type === "large")
      ) {
        violations.push(i);
      }
    }
    // Also flag large grids too close together
    const largeIndices = assignment
      .map((p, i) => (p.type === "large" ? i : -1))
      .filter((i) => i >= 0);
    for (let i = 1; i < largeIndices.length; i++) {
      if (largeIndices[i] - largeIndices[i - 1] < 14) {
        violations.push(largeIndices[i]);
      }
    }
    if (violations.length === 0) return true;
    // Pick a random violation, swap with a random other slot
    const vIdx = violations[Math.floor(rand() * violations.length)];
    const swapWith = Math.floor(rand() * assignment.length);
    [assignment[vIdx], assignment[swapWith]] = [
      assignment[swapWith],
      assignment[vIdx],
    ];
  }
  return checkConstraints(assignment);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const dates = dateRange(startArg, endArg);
const puzzlesDir = path.join(__dirname, "puzzles");
const levelsDir = path.join(__dirname, "levels");

const puzzles: PuzzleInfo[] = [];
const puzzleFiles: Record<string, Record<string, unknown>> = {};
const levelFiles: Record<string, Record<string, unknown>> = {};

for (const date of dates) {
  const pPath = path.join(puzzlesDir, `${date}.json`);
  const lPath = path.join(levelsDir, `${date}.json`);
  if (!fs.existsSync(pPath) || !fs.existsSync(lPath)) {
    console.error(`Missing files for ${date}`);
    process.exit(1);
  }
  const p = JSON.parse(fs.readFileSync(pPath, "utf8")) as Record<
    string,
    unknown
  >;
  const l = JSON.parse(fs.readFileSync(lPath, "utf8")) as Record<
    string,
    unknown
  >;
  puzzleFiles[date] = p;
  levelFiles[date] = l;
  puzzles.push({ date, name: p.name as string, type: getPuzzleType(p) });
}

console.log(
  `Shuffling ${puzzles.length} puzzles (${startArg} – ${endArg}), seed=${seedArg}`
);

const rand = makePrng(seedArg);
let assignment = shuffle(puzzles, rand);

const ok = tryFix(assignment, rand);
if (!ok) {
  console.error("Could not satisfy constraints after many attempts");
  process.exit(1);
}

// Print the plan
console.log("\nNew assignment:");
const typeSymbol = {
  standard: "·",
  gate: "G",
  splitter: "S",
  large: "L",
};
for (let i = 0; i < dates.length; i++) {
  const date = dates[i];
  const puzzle = assignment[i];
  const sym = typeSymbol[puzzle.type];
  const moved = puzzle.date !== date ? " ← was " + puzzle.date : "";
  console.log(`  ${date} ${sym} ${puzzle.name}${moved}`);
}

console.log("\nApply? (pass --apply to write files)");

if (!args.includes("--apply")) {
  process.exit(0);
}

// Write files
for (let i = 0; i < dates.length; i++) {
  const newDate = dates[i];
  const puzzle = assignment[i];
  const oldDate = puzzle.date;

  const pContent = { ...puzzleFiles[oldDate], date: newDate };
  const lContent = { ...levelFiles[oldDate], date: newDate };

  fs.writeFileSync(
    path.join(puzzlesDir, `${newDate}.json`),
    JSON.stringify(pContent, null, 2) + "\n"
  );
  fs.writeFileSync(
    path.join(levelsDir, `${newDate}.json`),
    JSON.stringify(lContent, null, 2) + "\n"
  );
}

console.log("\nDone! Files written.");
