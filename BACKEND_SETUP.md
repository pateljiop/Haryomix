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

Community posts are publicly visible immediately and have no account identity. Readers can report a post for spam, harassment, personal information, or another concern; reports are stored in D1 with a pending status and rate-limited. Reporting does not itself hide a post; a moderator must review it. Posting and reporting limits use one-way digests rather than storing raw IP addresses. Do not treat public posts or report details as private from the site operator.

## 4. Configure moderator access

1. Generate a unique random token with at least 32 characters using a password manager. Do not commit it to Git or put it in frontend source.
2. In Cloudflare Dashboard, open Workers & Pages → haryomix → Settings → Variables and Secrets (the label may vary by dashboard version).
3. Add `HARYOMIX_MODERATOR_TOKEN` as an encrypted/secret environment variable for the Production environment. Add a separate token to Preview only if needed.
4. Redeploy the latest `main` commit after saving the secret.
5. Open https://haryomix.pages.dev/moderation, paste the token and sign in. The dashboard can view reports, hide/restore posts, mark reports reviewed, or dismiss reports. The token is held in page memory and is not saved in browser storage.

The moderation API requires a Bearer token and returns no report data without successful authentication. Anyone with the moderator token can take moderation actions, so keep it private and rotate it immediately if exposed. This is a shared moderator token, not individual accounts, and the dashboard does not provide an audit trail of which human performed an action.

## 5. Configure AI providers (Groq + Gemini)

The workspace includes an AI assistant at **Workspace → Haryomix AI**. It can route Code Doctor, Exam Copilot, presentation-outline, and general questions to Groq or Gemini. Groq is preferred in automatic mode; Gemini is tried as a fallback when configured. Provider/model errors are returned as safe messages instead of exposing secret details.

1. In Cloudflare Dashboard, open **Workers & Pages → haryomix → Settings → Variables and Secrets**.
2. Add `GROQ_API_KEY` and/or `GEMINI_API_KEY` as encrypted secrets for **Production**. Never put provider keys in React code, `.env` committed to Git, or public GitHub secrets.
3. Redeploy the latest `main` commit after adding the secrets.
4. Open the workspace and select **Haryomix AI**. Choose the task and preferred provider, enter a prompt, and send it.
5. The API uses the existing D1 `community_rate_limits` table to limit each IP digest to 10 AI requests per hour. This is a basic safeguard, not a substitute for Cloudflare rate limiting and provider spending limits.

If no provider secret is configured, the API returns `503 ai_not_configured`. Provider quotas, pricing, model access and availability are controlled by Groq/Google and can change. AI responses can be wrong; verify code and study answers before relying on them. The initial version sends only the text entered in the AI prompt to the selected provider; it does not upload files or execute user code.

## Current scope

This backend foundation adds persistent community posting and a health endpoint. It does **not** yet add user accounts, project/file cloud storage, automatic code execution, or file uploads to AI. The AI chat endpoint requires provider secrets and server-side secret management; no API keys belong in browser code or Git.
