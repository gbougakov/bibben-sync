# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use `bun` for all package management:

```bash
bun install          # Install dependencies
bun test             # Run tests (vitest with Cloudflare Workers pool)
bun run dev          # Start local dev server
bun run deploy       # Deploy to Cloudflare
bun run cf-typegen   # Regenerate worker-configuration.d.ts after wrangler.jsonc changes
```

## Architecture

This is a Cloudflare Worker that syncs KU Leuven library seat reservations from ICS calendars into PostgreSQL. It's part of a larger "kom bibben" app where students can share their library reservations with friends.

**Three handlers in `src/index.ts`:**
- `fetch()` - HTTP endpoints: `POST /encrypt` (encrypt ICS URL), `POST /sync/:userId` (on-demand sync)
- `scheduled()` - Hourly cron that syncs all users with configured ICS URLs
- `email()` - Receives calendar sharing emails, extracts ICS URL, stores encrypted in DB

**Key modules:**
- `lib/crypto.ts` - AES-256-GCM encryption for ICS URLs (key in `ENCRYPTION_KEY` secret)
- `lib/ics-parser.ts` - Parses ICS files, filters events using hardcoded library regex patterns
- `lib/email-parser.ts` - Extracts ICS URL from Outlook sharing emails (validates sender domain)
- `lib/sync-service.ts` - Orchestrates: decrypt URL → validate domain → fetch ICS → parse → upsert reservations
- `lib/db.ts` - PostgreSQL queries via Hyperdrive

**Security boundaries:**
- ICS URLs are encrypted at rest; this worker holds the encryption key — the main app never sees plaintext URLs, isolating calendar access from the rest of the system
- Only `@student.kuleuven.be` sender emails are accepted — prevents arbitrary users from injecting ICS URLs via email
- Only `outlook.office365.com` ICS URLs are fetched — prevents SSRF; the worker will only make requests to Microsoft's calendar servers
- Only events matching `LIBRARY_PATTERNS` regex (CBA, RBIB, SBIB, EBIB) are extracted — even if a user's calendar contains personal events, only library reservations are synced (auditable allowlist)

## Database

Uses Hyperdrive to connect to PostgreSQL. The schema is managed externally (Prisma in the main app). Key tables: `User` (has encrypted `icsUrl`), `Reservation`, `Library`.

## Local Development

Requires `.dev.vars` with `ENCRYPTION_KEY` (base64-encoded 32-byte key) and a local PostgreSQL instance matching `localConnectionString` in `wrangler.jsonc`.
