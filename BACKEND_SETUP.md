# Haryomix backend setup

Haryomix is currently deployed as a static Cloudflare Pages site. The repository now includes Pages Functions for API health and a persistent community feed, plus a D1 schema migration. These routes do not become operational until a D1 database is created, migrated, and bound in Cloudflare.

## 1. Create and bind D1

1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database** and create a database named `haryomix-db`.
2. Open the `haryomix` Pages project → **Settings → Functions → Bindings**.
3. Add a D1 database binding with variable name **`DB`** and select `haryomix-db`. Repeat for Preview only if preview deployments should use a separate database.
4. Redeploy the Pages project after adding the binding.

## 2. Apply the schema

From a local checkout with Node.js and Wrangler installed, run:

```sh
npx wrangler d1 execute haryomix-db --remote --file=migrations/0001_community.sql
```

Confirm the database name in the command matches the database you created. Do not run this against a different production database by mistake.

## 3. Verify the API

- `GET /api/health` should return HTTP 200 and `database: "connected"`.
- `GET /api/community` should return `{ "posts": [] }` on a fresh database.
- `POST /api/community` accepts JSON: `{"displayName":"Hariom","message":"Hello Haryomix!"}`.

Community posts are publicly visible and currently have no account identity or moderation queue. The endpoint validates input and applies a basic per-IP hourly throttle using a one-way digest, but this is not a substitute for full identity, moderation, abuse reporting, or CAPTCHA. Do not treat public posts as private.

## Current scope

This backend foundation adds persistent community posting and a health endpoint. It does **not** yet add user accounts, project/file cloud storage, an AI provider, or real AI debugging. AI features require a configured model binding/provider and server-side secret management; no API keys belong in browser code or Git.
