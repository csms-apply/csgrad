# D1 schema (csgrad applicant DataPoints)

This directory is the **source of truth** for the Cloudflare D1 schema used by
the DataPoints stack. It lives in this public repo so the schema is reviewable
alongside the migration script. The actual D1 instance is created and operated
from the private `csgrad-backend` repo.

## Layout

- `schema.ts` — Drizzle ORM schema (TypeScript). Copy this verbatim into
  `csgrad-backend/src/db/schema.ts`.
- `migrations/0001_init.sql` — raw DDL applied to D1. Hand-written to stay free
  of `drizzle-kit` as a dependency. Must stay in sync with `schema.ts` (this
  directory's CI ought to assert that, but for now it's by inspection).

## Tables

Business tables (4):
- `applicants` — one row per user, derived from Seatable 「申请者信息」 (45 cols)
- `programs` — graduate programs, derived from Seatable 「项目列表」
- `datapoints` — admission outcomes, derived from Seatable 「DataPoints」
- `users` — managed by better-auth

Better-auth auxiliary tables (3): `accounts`, `sessions`, `verifications`. Names
and columns follow better-auth defaults so we can use its Drizzle adapter
without overrides.

## How to apply (in csgrad-backend)

```bash
# 1. Create the D1 database
wrangler d1 create csgrad-prod

# 2. Add the binding to wrangler.toml:
#    [[d1_databases]]
#    binding = "DB_CSGRAD"
#    database_name = "csgrad-prod"
#    database_id = "<uuid from step 1>"

# 3. Copy this file and apply the schema
cp ../csgrad/scripts/d1-schema/migrations/0001_init.sql ./migrations/
wrangler d1 migrations apply DB_CSGRAD --remote   # or --local for dev

# 4. Load the Seatable backfill (one-time)
cp ../csgrad/scripts/migration-output/001-applicants.sql ./tmp/
cp ../csgrad/scripts/migration-output/002-programs.sql ./tmp/
cp ../csgrad/scripts/migration-output/003-datapoints.sql ./tmp/
wrangler d1 execute DB_CSGRAD --file=tmp/002-programs.sql --remote
wrangler d1 execute DB_CSGRAD --file=tmp/001-applicants.sql --remote
wrangler d1 execute DB_CSGRAD --file=tmp/003-datapoints.sql --remote
# order matters: programs and applicants before datapoints (FK)
```

## Verification (local)

Generate the SQL first. Migration is fail-closed: source-count mismatches,
DataPoints without both required links, and blocking manual-review queues are
written to `manual-review.json`, then the command exits non-zero. Deterministic
duplicate-program merges are informational, not blocking. Do not load the SQL
into D1 until the blocking items are repaired.

```bash
node scripts/migrate-seatable-to-d1.mjs

# Diagnostic escape hatch only. The summary is marked INCOMPLETE/OVERRIDDEN.
node scripts/migrate-seatable-to-d1.mjs --allow-skips
```

This repo ships a local-sqlite end-to-end check. It reads source/emitted counts
from `manual-review.json` instead of accepting a hard-coded truncated count:

```bash
node scripts/d1-schema/verify-local.mjs
# 1. creates /tmp/csgrad-verify.db
# 2. applies 0001_init.sql
# 3. applies the three INSERT SQL files from scripts/migration-output/
# 4. runs row-count + sample-join assertions

# Verify an intentionally incomplete diagnostic artifact only:
node scripts/d1-schema/verify-local.mjs --allow-skips
```

## Schema invariants

- All ids are `TEXT` (ulid-style), generated at write time.
- `applicants.user_id` is **nullable**: legacy rows backfilled from Seatable have no
  OAuth identity yet; new submissions must set it.
- `datapoints` has `UNIQUE(applicant_id, program_id, academic_year, semester)` to
  block duplicate submissions.
- `programs.tier` is **nullable**; admin-curated. 220 / 283 rows start NULL after
  initial backfill — see `migration-output/manual-review.json`.
- TOEFL and IELTS are stored in **separate column groups**. Migration heuristic:
  Seatable total ≤ 10 → IELTS, else TOEFL.
- Recommendation-letter tags (`rec1_tags` … `rec5_tags`) are JSON arrays of
  short strings. SQLite has no native array type; serialize/deserialize at the
  API layer.
- `result` enum keeps the Seatable wording incl. `'默拒'` (silent reject). Do not
  normalize without a separate translation pass — semantics differ from `'Reject'`.
