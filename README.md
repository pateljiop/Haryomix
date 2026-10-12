# Haryomix

**A practical student workspace by Hariom Builds.** Haryomix brings coding checks, editable presentation exports, PDF page operations, image editing, and study practice into one responsive web app.

## Tools

- **Code Doctor:** local pattern checks for common syntax mistakes and debugging leads. It does not execute code or call an AI model.
- **PPT Studio:** creates editable `.pptx` presentations from a title, course, and slide outline.
- **PDF Studio:** merges PDFs, splits them into one-page files, rotates pages, reverses page order, removes the final page, and inspects page count.
- **Image Studio:** resize, center-crop, rotate, adjust brightness/contrast, and export PNG, JPEG, or WebP.
- **Exam Copilot:** creates a downloadable revision sheet from supplied topic labels and offers general computer-science practice questions.

## Privacy and document fidelity

Image and PDF operations run in the browser. The initial release does not require an account or external AI API key. PDF page operations copy existing page content instead of rebuilding it as editable text, which helps preserve embedded fonts and layout. This is not a guarantee for every unusual or encrypted PDF. Arbitrary text replacement with exact font and layout preservation is not included.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Limitations

- Code Doctor is a lightweight static-pattern helper, not a compiler, sandbox, or AI debugger.
- Exam questions are general practice items, not verified university past papers. Always check your own syllabus.
- PPT Studio creates a starter deck with editable text, not a fully researched academic presentation.
- PDF Studio does not claim exact font preservation when replacing arbitrary existing text. Non-destructive page operations are the supported path.
- Files are processed locally in the browser for the current utilities; closing or refreshing the page may clear the working state.

## Contributing

Bug reports and focused pull requests are welcome. Include reproduction steps, expected behavior, browser/runtime details, and tests for changed behavior. Keep student documents private in test fixtures.

## License

MIT. See [LICENSE](LICENSE).
