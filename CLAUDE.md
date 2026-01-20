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
```

No test suite is currently configured.

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
