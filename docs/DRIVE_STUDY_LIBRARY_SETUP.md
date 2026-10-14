# Haryomix Drive Study Library — setup

The study library uses a dedicated Google Drive folder as its private source. Students see Haryomix titles and generated learning content; the API never returns Drive file IDs, folder IDs, Drive links, or source URLs.

## Configure the dedicated Drive folder

1. Create a Google Cloud project and enable the Google Drive API.
2. Create a service account and a JSON key. Keep the key private.
3. Share only the dedicated study-material folder with the service-account email as Viewer.
4. Upload PDFs into that folder. Use descriptive filenames such as `BCA-Python-Functions.pdf`.
5. Use material you own or are licensed to use; do not redistribute copyrighted books without permission.

## Cloudflare Pages encrypted secrets

In Workers & Pages → haryomix → Settings → Variables and Secrets, add these for Production:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: service-account email
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: private key from the service-account JSON (newlines may be represented as `\n`)
- `GOOGLE_DRIVE_FOLDER_ID`: dedicated folder ID (server-side only)
- `HARYOMIX_STUDY_SYNC_TOKEN`: high-entropy admin-only sync token
- `GEMINI_API_KEY`: Gemini key for PDF-grounded generation

Never place these values in React code, Vite variables, Git, or public client requests. Never paste the private key or sync token into chat.

## Database and sync

The deployment workflow applies `migrations/0003_study_documents.sql`. Call `POST /api/study-sync` with `Authorization: Bearer <HARYOMIX_STUDY_SYNC_TOKEN>` from a trusted admin environment to sync the folder's PDF inventory. The endpoint supports up to 1,000 PDFs and marks removed files unavailable. `GET /api/study-library` lists only Haryomix document IDs and titles. `POST /api/study-library` accepts a Haryomix document ID, topic, and mode `notes` or `quiz`; the backend privately retrieves the PDF and sends it to Gemini. Drive IDs and links are not returned to students.

## Current boundaries

- Sync endpoint is ready for protected manual invocation; fully unattended sync still requires a scheduled Cloudflare Worker/cron caller.
- PDF generation supports files up to 15 MB and depends on Gemini PDF support and configured quotas.
- This first phase lists PDFs and generates content on demand; it does not pre-extract every PDF into a searchable chapter index.
- Keep sync access private and rotate secrets if exposed.
