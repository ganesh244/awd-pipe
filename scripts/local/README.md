# scripts/local — Local-Only Database Utilities

> ⚠️ **This folder is git-ignored. Files here are NEVER committed.**

Place one-off database administration scripts here:
- `fix_duplicates.ts` — removes orphan districts/areas
- `fix_users.ts` — reseeds users collection from `INITIAL_USERS`
- `query_districts.ts` — queries district nodes
- `query_lahari.ts` — lists all usernames

## Running a script
```bash
npx ts-node scripts/local/<script-name>.ts
```

## ⚠️ Rules
1. **No hardcoded passwords** — read passwords from `.env` or prompt at runtime.
2. **No personal usernames** — use environment variables.
3. **No destructive operations** without a `--confirm` flag.
