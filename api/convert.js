import path from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// pdf.mjs lives at <pdfjs-dist>/legacy/build/pdf.mjs; standard_fonts and the worker are siblings/under it
const PDFJS_LEGACY_BUILD_DIR = path.dirname(fileURLToPath(import.meta.resolve("pdfjs-dist/legacy/build/pdf.mjs")));
const STANDARD_FONT_DATA_URL = (
  path.join(PDFJS_LEGACY_BUILD_DIR, "..", "..", "standard_fonts") + path.sep
)
  .split(path.sep)
  .join("/");

GlobalWorkerOptions.workerSrc = import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");

export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST" }, { status: 405 });
    }

    let formData;
    try {
      formData = await request.formData();
    } catch (err) {
      return Response.json({ error: "Could not parse multipart form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Missing 'file' field with a PDF upload" }, { status: 400 });
    }
    if (file.type && file.type !== "application/pdf") {
      return Response.json({ error: "File must be a PDF" }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "PDF too large (max 20MB)" }, { status: 400 });
    }

    const format = (formData.get("format") || "jpeg").toString().toLowerCase();
    if (format !== "jpeg" && format !== "png") {
      return Response.json({ error: "format must be 'jpeg' or 'png'" }, { status: 400 });
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({
        data: new Uint8Array(arrayBuffer),
        standardFontDataUrl: STANDARD_FONT_DATA_URL,
      }).promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 3 });
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      await page.render({ canvasContext: ctx, viewport }).promise;

      const mimeType = format === "png" ? "image/png" : "image/jpeg";
      const buffer = format === "png" ? canvas.toBuffer("image/png") : canvas.toBuffer("image/jpeg", 0.97);

      return new Response(buffer, {
        status: 200,
        headers: { "Content-Type": mimeType },
      });
    } catch (err) {
      return Response.json({ error: "Conversion failed", detail: err.message }, { status: 500 });
    }
  },
};
