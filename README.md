# Quiz Rabbit 🐰

LINE LIFF quiz game built with Next.js App Router + PostgreSQL.

## Prerequisites

- Node.js 18+
- PostgreSQL 14+
- LINE Developers account (for LIFF)

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
# Edit .env.local with your values
```

### 3. Set up PostgreSQL

```bash
# Create database
createdb quiz_rabbit

# Run schema
psql postgresql://postgres:password@localhost:5432/quiz_rabbit -f sql/schema.sql

# Run seed data (10 questions)
psql postgresql://postgres:password@localhost:5432/quiz_rabbit -f sql/seed.sql
```

Or use the npm scripts:

```bash
export DATABASE_URL=postgresql://postgres:password@localhost:5432/quiz_rabbit
npm run db:init
npm run db:seed
```

### 4. Set up LINE LIFF

1. Go to [LINE Developers Console](https://developers.line.biz/)
2. Create a LINE Login channel
3. Add a LIFF app (choose "Full" or "Tall" size)
4. Set Endpoint URL to your deployment URL
5. Copy LIFF ID → `NEXT_PUBLIC_LIFF_ID` in `.env.local`
6. Copy Channel ID → `LINE_CHANNEL_ID` in `.env.local`
7. Copy Channel Secret → `LINE_CHANNEL_SECRET` in `.env.local`

### 5. Run development server

```bash
npm run dev
```

Open http://localhost:3000

### 6. Create a quiz session (for testing)

```bash
# Start a quiz session via API
curl -X POST http://localhost:3000/api/quiz/start \
  -H "Content-Type: application/json" \
  -d '{"campaign_slug": "general-knowledge", "liff_id_token": "YOUR_LIFF_TOKEN"}'

# Response includes scan_token → open /scan/{scan_token}
```

## Project Structure

```
quiz_rabbit/
├── app/
│   ├── layout.tsx              # Root layout (Noto Sans Thai font)
│   ├── page.tsx                # Landing page
│   ├── result/page.tsx         # Score result page
│   ├── scan/[token]/
│   │   ├── page.tsx            # SSR quiz question page
│   │   └── not-found.tsx       # Invalid/expired token
│   └── api/
│       ├── auth/verify-liff/   # POST - Verify LIFF ID token
│       └── quiz/
│           ├── start/          # POST - Create session + scan token
│           ├── next/           # GET  - Next question for session
│           └── answer/         # POST - Submit answer
├── components/
│   ├── QuestionCard.tsx        # Client component - quiz interaction
│   ├── CharacterDisplay.tsx    # Client component - character animation
│   ├── ThemeProvider.tsx       # Client component - CSS variables
│   └── LiffInitializer.tsx     # Client component - LIFF SDK init
├── lib/
│   ├── db.ts                   # PostgreSQL connection pool
│   ├── quiz.ts                 # Core quiz logic (sessions, questions, scoring)
│   ├── liff.ts                 # LIFF token verification (server-side)
│   ├── theme.ts                # Theme utilities
│   └── types.ts                # TypeScript type definitions
├── sql/
│   ├── schema.sql              # Database schema (9 tables)
│   └── seed.sql                # Seed data (theme, character, 10 questions)
└── public/assets/              # Character SVG assets
```

## Architecture

- **SSR**: `/scan/[token]` renders on server → no correct answer in HTML
- **Auth**: LIFF ID token verified server-side via LINE JWKS
- **Randomization**: Transaction-based to prevent race conditions
- **Theming**: JSONB config in DB → CSS variables → zero code change to retheme
- **Character**: Swap by updating `quiz_characters` row in DB

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | Server | PostgreSQL connection string |
| `NEXT_PUBLIC_LIFF_ID` | Client | LIFF app ID for `liff.init()` |
| `LINE_CHANNEL_ID` | Server | LINE Login channel ID (token verification) |
| `LINE_CHANNEL_SECRET` | Server | LINE Login channel secret |
