# Haryomix Product Audit — Baseline

**Audit date:** 2026-10-14  
**Repository:** https://github.com/pateljiop/Haryomix  
**Audited revision:** 39a0c8e42dd2dbebfc7516bec00a11346d8c92e5  
**Scope:** Repository metadata, current source/configuration, CI/deploy workflows and documented product behavior. This is a source-level audit; it is not a claim that every browser workflow was manually exercised.

## Baseline status

- Default branch: main.
- No open pull requests were returned by the repository-scoped open-PR search at audit time.
- Latest main commit: 39a0c8e — “Lock patched image-size dependency”.
- Latest observed CI run: [Run #152](https://github.com/pateljiop/Haryomix/actions/runs/38454625018), completed successfully on the audited commit.
- Latest observed Cloudflare Pages deployment workflow: [Run #106](https://github.com/pateljiop/Haryomix/actions/runs/38454624901), completed successfully on the audited commit. The workflow includes route-shell checks, /api/health + D1 verification, and a community persistence smoke test.
- At the audited baseline commit, .github/workflows/ci.yml ran npm ci, npm run typecheck, and npm run build only. This was corrected in subsequent implementation PRs.
- Current CI also runs npm test. The suite covers community/moderator APIs, PDF page parsing/reordering, image export helpers, AI provider fallback, and mocked Felo PPT/image responses. A dedicated lint script is still not configured.
- After the baseline audit, PR #5 added the native Node test runner; PR #6 added PDF/Image regression coverage; PR #7 added the GPU-rendered WebGL hero; PR #8 added AI API tests and corrected rate-limit setup errors.
- GitHub reports the main branch as unprotected. This makes passing checks dependent on workflow/merge discipline rather than required branch-protection checks.

## Existing implementation confirmed by source

- React 19 + TypeScript + Vite frontend.
- Cloudflare Pages Functions for health, AI, community, reporting and moderation APIs.
- Browser-side PDF/image processing dependencies: pdf-lib, pdfjs-dist, tesseract.js; editable PPTX export via pptxgenjs.
- Dedicated workspace routes for Code Doctor, PPT Studio, PDF Studio, Image Studio, Exam Copilot, Haryomix AI, AI Create Studio, local-first Study Planner and Flashcards.
- Landing-page hero now includes a native WebGL particle sphere with reduced-motion handling and a CSS fallback; the existing dark theme and workspace artwork are preserved.
- AI routes include input/content-type limits, no-store responses, provider timeouts, server-side provider secrets and D1-backed hourly rate limits.
- Community and reporting schemas are present in migrations 0001 and 0002; migration 0001 also creates community_rate_limits.
- PR #3 was merged as 748f8ae443d9053b7314f28f8f58fe71342bc6e3. It added workspace route/tool-index improvements and additional PDF/image operations. Its description explicitly keeps OCR, true image-level PDF compression, Office conversion, secure redaction and certificate-backed signatures out of the implemented-feature claims.

## Gaps and risks, ranked

### P0 — Quality gates and regression coverage

1. **Completed:** CI now runs a repeatable Node regression suite alongside typecheck and production build. The local-first Study Planner is implemented with JSON backup/restore and a separate route; its data-model logic is covered by unit tests. Flashcards now provides local decks, answer reveal, due-card queue and SM-2-style review intervals with JSON backup/restore.
2. **Completed in part:** Tests cover API validation, community/moderator authorization, PDF page selection and real PDF page reordering, image dimension/target-size helpers, AI provider fallback, and mocked Felo PPT/image responses.
3. **Remaining:** Browser-level E2E tests for actual canvas image exports, PDF downloads, workspace navigation/back-forward behavior, and WebGL rendering on desktop/mobile.
4. Decide and document branch-protection/required-check policy; current main is reported unprotected.

### P0 — Documentation consistency

1. The initial baseline README mismatch was corrected; keep feature descriptions synchronized with future changes.
2. The documented Cloudflare D1 binding is DB, matching the Pages Functions and deployment workflow.
3. Continue distinguishing OCR, raster compression, image-based PDF-to-PPTX, crop-box changes, visual signatures, secure redaction and certificate-backed digital signatures; they are not equivalent capabilities.

### P1 — Product verification

1. Native WebGL particle rendering is implemented with reduced-motion handling and a CSS fallback; desktop/mobile visual inspection and real-GPU behavior still need a browser session.
2. Deployment smoke checks confirm all nine workspace URLs return HTTP 200 and the SPA shell; actual tool-level navigation and browser back/forward behavior still need E2E coverage.
3. Unit tests cover PDF page reorder output and image helper constraints; exercise full PDF/image exports against representative files and inspect downloaded artifacts.
4. Mocked AI tests cover fallback and response parsing. Live provider credentials, model availability, quotas and billing have not been verified; do not trigger billable generation merely as a smoke test.
5. Verify deployed custom-domain status separately; the workflow evidence establishes the haryomix.pages.dev production path, not any custom domain.

### P1 — Student-facing depth

1. Code Doctor is documented as heuristic/static pattern analysis, not a compiler or sandbox.
2. PPT Studio is documented as an editable starter deck rather than a researched presentation generator.
3. Exam Copilot's questions are general practice, not verified university past papers; syllabus claims must be source-grounded.
4. Persistent personal notes, revision progress and study schedules need an explicit storage/privacy design before being presented as saved features.

### P2 — Research and utility expansion

Create a licensing/maintenance-reviewed GitHub research matrix before adding dependencies or copying code. Prioritize student value and reliability over feature count.

## Recommended next implementation sequence

1. Add browser-level E2E and visual checks for direct routes, mobile navigation, PDF/Image downloads and WebGL fallback/reduced-motion behavior.
2. Perform artifact-level PDF/Image QA with representative real files.
3. Verify live AI provider configuration safely, without exposing secrets or spending credits without approval.
4. Decide and document branch protection/required checks.
5. Research and prioritize student utilities using a licensing/security-reviewed GitHub research matrix.
6. Re-run production verification after each release.

## Verification limits

As of main commit 8389ca7, CI run #174 and Cloudflare Pages deployment run #119 both completed successfully. Deployment checks confirmed all seven workspace route shells, API/D1 health, safe AI input validation without provider calls, community persistence and unauthenticated moderation rejection. The 34-test regression suite passed in CI. This audit did not execute npm commands in a local checkout or independently inspect a real browser session; canvas exports, WebGL rendering and live provider credentials remain unverified.
