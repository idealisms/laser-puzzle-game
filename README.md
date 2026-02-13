# Laser Puzzle Game

A daily laser puzzle game where players place mirrors on a grid to redirect a laser beam, aiming for the longest path possible. New puzzles every day!

**Play now:** https://laser-puzzle-game.vercel.app/

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL database)

## Local Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Set up PostgreSQL with Docker

**First time setup:**

```bash
# Start Docker daemon (WSL/Linux)
sudo service docker start

# Create and start Postgres container
docker run --name laser-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=laser_puzzle -p 5432:5432 -d postgres:16
```

**Subsequent runs:**

```bash
# Start Docker daemon (WSL/Linux)
sudo service docker start

# Start existing container
npm run db:start
```

### 3. Set up environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/laser_puzzle"
```

### 4. Run database migrations and seed

```bash
# Run migrations
npx prisma migrate dev

# Seed the database with puzzle levels
npm run db:seed
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Create production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:start` | Start PostgreSQL Docker container |
| `npm run db:seed` | Seed database with puzzle levels |
| `npm run db:reset` | Reset database and run migrations |

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4
- **Database:** PostgreSQL with Prisma ORM
- **Analytics:** Vercel Analytics
- **Language:** TypeScript
