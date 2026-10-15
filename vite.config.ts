import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const copyPdfStandardFonts = {
  name: "copy-pdfjs-standard-fonts",
  apply: "build" as const,
  closeBundle() {
    const source = resolve("node_modules/pdfjs-dist/standard_fonts");
    const destination = resolve("dist/standard_fonts");
    mkdirSync(destination, { recursive: true });
    cpSync(source, destination, { recursive: true });
  },
};

export default defineConfig({
  plugins: [react(), copyPdfStandardFonts],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (id.includes("/pdfjs-dist/")) return "pdfjs";
          if (id.includes("/tesseract.js/") || id.includes("/tesseract-core/")) return "ocr";
          if (id.includes("/pptxgenjs/")) return "pptx";
          if (id.includes("/pdf-lib/")) return "pdf-lib";
        },
      },
    },
  },
});
