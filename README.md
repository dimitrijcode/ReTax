# ReTax

Calendar → invoice → review → booking, with a Taxfix-like UI. Default is **fixture mode**: no Google or Anthropic keys required.

## Run the fixture MVP

```bash
cp .env.example .env
pnpm install
pnpm fixtures:pdf
pnpm dev
```

Equivalent: `pnpm --filter web dev`. Open [http://localhost:3000](http://localhost:3000).

Then:

1. Click **Scan starten**. Progress streams over SSE (calendar, mail, invoice).
2. A review window opens at `/review/[id]`.
3. Walk the four screens: Fund → Personal/Company → business-use slider → AfA plan + SKR03 journal → **Buchen**.
4. Success copy: “Done. We added it to your year.”

Persistence is `data/store.json` (gitignored). Prisma schema at `prisma/schema.prisma` is documentation only — do not run `prisma generate` for this MVP.

## What the demo uses

Hardcoded fixture data in `apps/web/lib/fixtures.ts`, plus files in `fixtures/`:

| Fixture | Content |
| --- | --- |
| `fixtures/calendar.json` | Event **Laptop kaufen** (12.09.2026) |
| `fixtures/gmail.json` | Mail with a PDF invoice attachment |
| `fixtures/invoice.json` | Extracted fields (vendor, date, number, net/VAT/gross) |
| `fixtures/laptop-invoice.pdf` | Generated invoice (`pnpm fixtures:pdf`) |

`RETAX_MODE=fixture` is the default in `.env.example`. Google OAuth routes show **Connect Google** but are not required.

## Packages

| Name | Path | Role |
| --- | --- | --- |
| `web` | `apps/web` | Next.js 15 App Router, orchestrator, review wizard |
| `@retax/mcp-server` | `packages/mcp-server` | Invoice extract + MCP tools (not required for the fixture demo) |
| `@retax/tax-engine` | `packages/tax-engine` | HGB/EStG AfA + SKR03 journal |
| `@retax/google` | `packages/google` | OAuth + Calendar/Gmail wrappers (unused in fixture mode) |

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Next.js dev server |
| `pnpm fixtures:pdf` | Write `fixtures/laptop-invoice.pdf` |
| `pnpm test` | Package tests |
| `pnpm build` | Typecheck/build workspaces |
