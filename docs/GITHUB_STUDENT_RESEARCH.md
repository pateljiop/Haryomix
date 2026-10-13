# Student Productivity & PDF Tooling Research

**Research date:** 2026-10-14  
**Purpose:** Find student-useful open-source projects for product inspiration before adding features or dependencies to Haryomix. This is a repository-level screening, not a full code/security audit.

## Executive decision

Do not copy an entire student app or add a large dependency just to increase feature count. Haryomix already has seven dedicated workspace routes and browser-based PDF/image tools. The strongest next work is to make current features reliable with browser-level tests, then add genuinely useful student workflows: local study library, revision planning, flashcards/spaced repetition, and study progress.

Use the repositories below for workflow ideas. Before copying any code, inspect the exact file/folder license, dependency chain, security posture and architecture compatibility.

## Repository matrix

| Project | License signal | Maintenance signal (GitHub metadata checked 2026-10-14) | Useful product ideas | Haryomix decision |
|---|---|---|---|---|
| [StudyCoach](https://github.com/Professional-X/StudyCoach) | README badge claims MIT and links to LICENSE.md, but the root contents listing did not include that file; **license not verified**. | 1 star, 0 forks; last push reported 2026-07-10. | Spaced-repetition flashcards, study timer, streaks, weekly goals, revision suggestions. | Feature inspiration only. Do not reuse source until the missing license file is resolved and code is reviewed. |
| [arthalabs-in/study](https://github.com/arthalabs-in/study) | MIT, verified from repository LICENSE. | 5 stars, 1 fork; last push reported 2026-06-10; not archived. | Grounded chat over user-owned documents, quizzes from weak areas, flashcards, notes, document-linked progress, Anki export, bring-your-own-provider support. | Use the workflow concepts. It is primarily a terminal/TUI-oriented Python project, so do not import its architecture into the React/Cloudflare app. |
| [StudyLife](https://github.com/lukislp/studylife) | AGPL-3.0, verified from LICENSE. | 2 stars, 0 forks; pushed 2026-10-12; not archived. | Calendar, exam/study planner, focus timer, notes, progress dashboard, passkey login, multilingual support. | High-value feature reference. Avoid copying code into a differently licensed hosted product without a licensing review; its .NET/self-hosted stack also differs from Haryomix. |
| [StudySky](https://github.com/suburb6/StudySky) | AGPL-3.0, verified from LICENSE. | 2 stars, 0 forks; pushed 2026-10-13; not archived. | Weekly timetable, modules/chapters, revision, private document uploads, tenant isolation, optional OCR and self-hosting. | Use privacy and workflow ideas only. Its Docker/Postgres/worker setup and stated 2 GB base RAM requirement are not a drop-in fit for Cloudflare Pages. |
| [Student Study Planner](https://github.com/Bheki0987/student-study-planner-web-app) | MIT, verified from LICENSE. | 0 stars, 1 fork; last push reported 2026-01-05; not archived. | Calendar and deadlines, Pomodoro, grade calculator, notes, flashcards, analytics and collaboration. | Useful checklist of student needs, but low visible adoption and older updates mean the implementation needs a deeper code/security review before reuse. |
| [Stirling-PDF](https://github.com/Stirling-Tools/Stirling-PDF) | Root LICENSE states MIT for general content but lists multiple directory-specific license exceptions; GitHub API reports NOASSERTION. | 94k stars, 11k+ forks; pushed 2026-10-13; not archived. | Broad PDF workflow coverage and a useful feature taxonomy for merge/split/convert/metadata operations. | Benchmark the feature list and UX only. Inspect per-directory licensing before reusing any code; do not assume the entire repository is uniformly MIT. |
| [Mozilla PDF.js](https://github.com/mozilla/pdf.js) | Apache-2.0, reported by GitHub. | 53k+ stars, 10k+ forks; pushed 2026-10-13; not archived. | Reliable PDF rendering/viewing and browser-based document preview patterns. | Haryomix already uses pdfjs-dist. Keep using the existing dependency rather than adding a duplicate PDF renderer. |

## Product implications for Haryomix

### Priority 0 — Reliability before more features

1. Keep the npm test suite, typecheck and production build in CI.
2. Add browser-level E2E coverage for direct workspace routes, back/forward navigation, PDF downloads, image canvas exports and WebGL fallback/reduced-motion behavior.
3. Test PDF/Image operations using representative real files and inspect the downloaded artifacts. Helper tests alone do not prove the full browser workflow works.
4. Keep production smoke tests safe: invalid-input checks may run automatically; do not trigger billable AI generation during deployment.

### Priority 1 — Student features with strong value

1. **Revision planner — initial version shipped:** subject-tagged tasks, deadlines, priorities and estimated study time. Calendar views and reminders remain future work.
2. **Flashcards with spaced repetition — initial version shipped:** question/answer decks, due-date queue, Again/Hard/Good/Easy ratings, local progress and JSON backup; no provider key required.
3. **Student Utility Hub — initial version implemented:** marks percentage, credit-weighted CGPA estimate, attendance target/skips calculator, text/word counter, JSON formatter/validator and URL component encoder/decoder. Calculations run locally and have unit tests.
4. **Study timer and sessions — initial version shipped:** 25-minute focus blocks, 5/15-minute breaks, completed-session log, daily totals and streak calculation with local JSON backup.
5. **Local study library — in progress:** save notes and study resources in IndexedDB with explicit export/import and clear deletion controls. Do not promise cloud persistence unless a backend and account/privacy model exist.
6. **Document-grounded study help:** only when a provider is configured; distinguish answers grounded in supplied material from general knowledge, and disclose when content is sent to the configured provider.

### Priority 2 — Evaluate carefully

- OCR on scanned notes: measure browser memory, worker size, language support and mobile performance before shipping.
- Collaboration rooms: require a clear authentication, abuse-prevention and data-isolation design; do not bolt on real-time infrastructure only for feature parity.
- Full Office/PDF conversion, secure redaction and cryptographic signatures: treat as separate engineering projects with artifact-level tests, not as small UI additions.

## Reuse and security rules

- Do not copy code from AGPL-3.0 projects into the hosted Haryomix application without an explicit license/compliance decision.
- A README badge is not sufficient proof of licensing when the referenced license file is missing.
- For repositories with custom/proprietary subdirectories, check the exact source path and its license before reuse.
- Review dependency maintenance, open issues, releases, security advisories, transitive dependencies and data handling before adding packages.
- Prefer implementing the required behavior with existing dependencies when practical. Avoid shipping code copied from demo/student projects without tests and security review.

## Sources

- https://github.com/Professional-X/StudyCoach
- https://github.com/arthalabs-in/study
- https://github.com/lukislp/studylife
- https://github.com/suburb6/StudySky
- https://github.com/Bheki0987/student-study-planner-web-app
- https://github.com/Stirling-Tools/Stirling-PDF
- https://github.com/mozilla/pdf.js

Repository stars, timestamps and license metadata are a snapshot from 2026-10-14 and may change. This document does not certify the security, correctness or full licensing status of any project.
