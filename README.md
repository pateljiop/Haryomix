# Haryomix

**A practical student workspace by Hariom Builds.** Haryomix brings coding checks, editable presentation exports, PDF page operations, image editing, AI-assisted workflows, revision practice, a local-first Study Planner, Flashcards, a Pomodoro Focus Timer and a Student Utility Hub into one responsive web app.

## Workspace tools

- **Code Doctor:** local pattern checks for common syntax mistakes and debugging leads. It does not execute or compile code. AI-assisted debugging is a separate server-backed Haryomix AI workflow.
- **PPT Studio:** creates an editable starter .pptx deck from a title, course and slide outline. It is not a guarantee of fully researched academic content.
- **PDF Studio:** supports merge, split, page extraction/removal, custom page order, rotation, page numbers, text watermarks, crop-box margins, visual signature placement, metadata inspection/clearing, images-to-PDF and basic object-stream repacking. Repacking is not the same as image-level compression.
- **Image Studio:** supports resizing, target-size compression attempts, crop, rotation, brightness/contrast and PNG, JPEG or WebP export. The tool reports the actual output size; a target size cannot be guaranteed for every image.
- **Exam Copilot:** creates revision material from supplied topics and provides general practice questions. Questions are not verified university past papers.
- **Study Planner:** organize tasks by subject, deadline, priority and estimated study time. Tasks are stored in this browser and can be exported/imported as JSON; there is no cloud sync or account.
- **Flashcards:** create question/answer decks, review due cards with Again/Hard/Good/Easy ratings, and schedule intervals with a lightweight SM-2-style algorithm. Cards are stored in this browser and support JSON backup/restore.
- **Focus Timer:** use 25-minute focus blocks, 5-minute short breaks or 15-minute long breaks. Completed focus sessions are tracked locally and can be exported/imported as JSON.
- **Study Library:** save class notes, revision summaries and trusted web links in browser IndexedDB. Search and filter items, edit or delete them, and export/import a JSON backup. Data is local to this browser and is not synced.
- **Student Utility Hub:** calculate marks percentage, credit-weighted CGPA estimates and attendance targets; count words/characters/lines; format and validate JSON; and encode/decode URL components. Calculations and text processing stay in the browser.
- **Haryomix AI and AI Create Studio:** use server-side configured provider integrations when credentials and service bindings are available.

## Backend and community

Cloudflare Pages Functions provide health, AI, community, reporting and moderation endpoints. The Pages Functions expect a Cloudflare D1 database binding named **DB**. The deployment workflow applies the SQL files in migrations/ and runs production smoke checks, including API health/D1 connectivity and community persistence.

The community feed does not require a user account. Do not post private or sensitive information. Moderator endpoints require the configured HARYOMIX_MODERATOR_TOKEN secret.

## Privacy and document fidelity

PDF and image editing operations are performed in the browser for the supported local workflows. AI workflows send the submitted prompt/content to the configured provider through server-side functions; do not submit sensitive content unless you are comfortable with that provider's data handling. API credentials must remain in encrypted server-side environment secrets and must never be placed in client code.

PDF page operations copy existing page content rather than rebuilding it as editable text, which can help preserve embedded fonts and layout. This is not a guarantee for every unusual or encrypted PDF. A visual signature is an image/appearance, not a certificate-backed cryptographic digital signature.

## Deploy to Cloudflare Pages

The production hosting target is **Cloudflare Pages**, with the project name haryomix. The GitHub Actions workflow in .github/workflows/cloudflare-pages.yml builds the Vite app and deploys the dist/ directory on pushes to main.

Repository Actions secrets used by the workflow:

- CLOUDFLARE_API_TOKEN: a Cloudflare API token with permission to manage Cloudflare Pages and run the configured D1 migration/smoke-test steps.
- CLOUDFLARE_ACCOUNT_ID: the Cloudflare account ID.

The workflow deploys to the main production branch and checks the eleven workspace URLs, the health/D1 endpoint, safe AI input validation and community persistence. The default public address is https://haryomix.pages.dev. Custom-domain status must be checked separately in Cloudflare Pages. Never commit API tokens or paste them into source files.

## Local development

Requires Node.js 22+.

```bash
npm ci
npm run dev
npm run typecheck
npm run build
```

The current CI runs dependency installation, TypeScript checks, automated regression tests (npm test) and a production build, including local Study Planner data-model tests. A dedicated lint script and browser-level end-to-end suite are not currently configured; see [the product audit](./docs/PRODUCT_AUDIT.md) for remaining verification work.

## Explicit limitations

- Code Doctor is a lightweight static-pattern helper, not a compiler, execution sandbox or proof that code works.
- Exam questions are general practice items, not verified university past papers. Always compare generated material with the official syllabus.
- PPT Studio creates an editable starter deck, not a guarantee of fully researched or fact-checked academic content.
- PDF text editing with exact font/layout preservation, secure redaction, certificate-backed signing, password removal, repair, OCR and PDF-to-Office conversion must not be assumed supported unless a dedicated implementation is added and tested.
- PDF object-stream repacking is not true image-level compression. A crop box is not secure redaction.
- PDF/image editing state may be lost when the page is refreshed or closed. Study Planner tasks, Flashcards and Focus Timer history persist in this browser storage only and should be backed up before clearing browser data or switching devices. Community posts persist only when the production D1 binding and migrations are available.

## Contributing

Bug reports and focused pull requests are welcome. Include reproduction steps, expected behavior, browser/runtime details and tests for changed behavior. Keep student documents private in test fixtures.

## License

MIT. See [LICENSE](./LICENSE).
